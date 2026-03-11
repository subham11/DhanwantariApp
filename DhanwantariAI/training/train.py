"""
train.py  —  Unified DhanwantariAI fine-tuning script
------------------------------------------------------
Usage:
    python3 training/train.py --variant gemma3-1b
    python3 training/train.py --variant gemma3-1b --language hi
    python3 training/train.py --variant gemma3-4b --dry-run

--variant   required  : which base model to fine-tune (from sync/model_variants.json)
--language  optional  : language code for a language-pack adapter (default: en)
                        Language pack = LoRA adapter (~40MB) trained on <lang> Q&A pairs.
                        Base model downloaded once; only the adapter changes per language.
                        Training data must live in training_data/lang/<lang>/
                        Generate it with: python3 scripts/generate_finetune_dataset.py --language <lang>

All hyperparameters are read from sync/model_variants.json — zero hardcoded config here.
To add a new model tier: add a variant entry to model_variants.json, zero code changes here.
To add a new language: create training/lang/<code>/system_prompt.txt + training data, zero code changes.

Dependencies (install on RunPod before running):
    pip install unsloth transformers datasets trl peft accelerate bitsandbytes

RunPod recommended specs:
    Variant gemma3-1b : 1× RTX 3090 24GB (~45 min)   or A100 40GB
    Variant gemma3-4b : 1× A100 80GB    (~2.5 hr)

Output — English (base):
    training/output/<variant_id>/adapter/          ← LoRA adapter
    training/output/<variant_id>/merged/           ← merged model (--merge)

Output — language pack (--language hi):
    training/output/<variant_id>/lang-hi/adapter/  ← Hindi LoRA adapter (~40MB)
    (base model is NOT re-trained; only the adapter is new)

Environment variables (optional overrides):
    TRAIN_JSONL   path to training JSONL  (overrides language-based default path)
    VAL_JSONL     path to validation JSONL (overrides language-based default path)
    OUTPUT_DIR    output directory
    HF_TOKEN      Hugging Face token (required for gated models like Gemma 3)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent   # repo root

# ══════════════════════════════════════════════════════════════════════════
# Load variant config from model_variants.json
# ══════════════════════════════════════════════════════════════════════════

def load_variant(variant_id: str) -> tuple[dict, dict]:
    """Return (variant_dict, training_cfg_dict) from model_variants.json."""
    cfg_path = ROOT / 'sync' / 'model_variants.json'
    if not cfg_path.exists():
        sys.exit(f'ERROR: {cfg_path} not found. Run from repo root or check path.')
    with open(cfg_path, encoding='utf-8') as f:
        cfg = json.load(f)
    for v in cfg.get('variants', []):
        if v['id'] == variant_id:
            # training is a flat dict (no nested 'shared')
            return v, cfg.get('training', {})
    available = [v['id'] for v in cfg.get('variants', [])]
    sys.exit(
        f'ERROR: variant "{variant_id}" not found in model_variants.json.\n'
        f'Available variants: {available}'
    )


# ══════════════════════════════════════════════════════════════════════════
# Training
# ══════════════════════════════════════════════════════════════════════════

def _lang_data_paths(language: str, shared_training: dict) -> tuple[Path, Path]:
    """Return (train_jsonl, val_jsonl) based on language.

    English uses the canonical paths from model_variants.json.
    Any other language uses training_data/lang/<code>/train.jsonl + val.jsonl.
    Both paths can be overridden via TRAIN_JSONL / VAL_JSONL env vars.
    """
    if language == 'en':
        default_train = str(ROOT / shared_training.get(
            'dataset_file', 'training_data/dhanwantari_train.jsonl'))
        default_val   = str(ROOT / shared_training.get(
            'val_file', 'training_data/dhanwantari_val.jsonl'))
    else:
        lang_dir      = ROOT / 'training_data' / 'lang' / language
        default_train = str(lang_dir / 'train.jsonl')
        default_val   = str(lang_dir / 'val.jsonl')
    return (
        Path(os.environ.get('TRAIN_JSONL', default_train)),
        Path(os.environ.get('VAL_JSONL',   default_val)),
    )


def train(
    variant_id:    str,
    language:      str  = 'en',
    dry_run:       bool = False,
    merge_weights: bool = False,
) -> None:
    variant, shared_training = load_variant(variant_id)

    base_model = variant['base_model_hf']    # e.g. 'google/gemma-3-1b-it'
    train_jsonl, val_jsonl = _lang_data_paths(language, shared_training)

    # Output dir: language adapters nest under the variant dir
    if language == 'en':
        default_out = str(ROOT / 'training' / 'output' / variant_id)
    else:
        default_out = str(ROOT / 'training' / 'output' / variant_id / f'lang-{language}')
    output_dir = Path(os.environ.get('OUTPUT_DIR', default_out))

    # ── Hyperparameters from shared training block in model_variants.json ─
    lora_r           = shared_training.get('lora_r', 16)
    lora_alpha       = shared_training.get('lora_alpha', 32)
    lora_dropout     = shared_training.get('lora_dropout', 0.1)
    lora_targets     = shared_training.get('lora_target_modules', [
                           'q_proj', 'k_proj', 'v_proj', 'o_proj',
                           'gate_proj', 'up_proj', 'down_proj',
                       ])
    learning_rate    = shared_training.get('learning_rate', 1e-4)
    num_epochs       = shared_training.get('num_train_epochs', 5)
    max_seq_length   = shared_training.get('max_seq_length', 2048)
    warmup_ratio     = shared_training.get('warmup_ratio', 0.1)
    weight_decay     = shared_training.get('weight_decay', 0.05)
    batch_size       = shared_training.get('per_device_train_batch_size', 4)
    grad_accum       = shared_training.get('gradient_accumulation_steps', 4)
    lr_schedule      = shared_training.get('lr_scheduler', 'cosine')
    bf16             = shared_training.get('bf16', True)    # default True; Unsloth auto-detects
    max_grad_norm    = shared_training.get('max_grad_norm', 0.3)
    eval_steps       = shared_training.get('eval_steps', 50)
    save_steps       = shared_training.get('save_steps', 100)
    save_total_limit = shared_training.get('save_total_limit', 5)
    early_stop_pat   = shared_training.get('early_stopping_patience', 3)

    is_lang_pack = language != 'en'
    pack_label   = f'language pack [{language}]' if is_lang_pack else 'base (en)'

    print(f'DhanwantariAI Fine-Tuning — {variant_id}  |  {pack_label}')
    print('=' * 60)
    print(f'  Base model   : {base_model}')
    print(f'  Language     : {language}' +
          (' — adapter only, base model NOT retrained' if is_lang_pack else ''))
    print(f'  Train data   : {train_jsonl}')
    print(f'  Val data     : {val_jsonl}')
    print(f'  Output dir   : {output_dir}')
    print(f'  LoRA rank    : {lora_r}  alpha={lora_alpha}  dropout={lora_dropout}')
    print(f'  Learning rate: {learning_rate}   epochs={num_epochs}  warmup={warmup_ratio}')
    print(f'  Batch size   : {batch_size}  grad_accum={grad_accum}  '
          f'(effective={batch_size * grad_accum})')
    print(f'  weight_decay : {weight_decay}  max_grad_norm={max_grad_norm}')
    print(f'  eval_steps   : {eval_steps}  save_steps={save_steps}  '
          f'early_stop_patience={early_stop_pat}')
    print(f'  Max seq len  : {max_seq_length}')
    print(f'  bf16         : {bf16}')

    if is_lang_pack:
        print(f'\n  Language pack note:')
        print(f'  • Adapter size on disk: ~40MB (vs full model ~529MB)')
        print(f'  • User downloads base model once; only this adapter is new')
        print(f'  • Training data must be in {language} (system prompt + Q&A pairs)')
        print(f'    Generate with: python3 scripts/generate_finetune_dataset.py --language {language}')
        print(f'  • Translation sidecar (UI strings) → assets/translations/{language}/')

    if dry_run:
        print('\n[DRY-RUN] Config validated. Would train with the above settings.')
        if not os.environ.get('HF_TOKEN') and 'gemma' in base_model.lower():
            print('[DRY-RUN] NOTE: Set HF_TOKEN env var before actual training (Gemma 3 is gated).')
        return

    if not train_jsonl.exists():
        msg = (
            f'ERROR: Training data not found: {train_jsonl}\n'
            f'For language pack [{language}], generate translated training pairs first:\n'
            f'  python3 scripts/generate_finetune_dataset.py --language {language}\n'
            f'  Then translate all assistant responses in the JSONL to {language}.'
        ) if is_lang_pack else (
            f'ERROR: Training data not found: {train_jsonl}\n'
            f'Run: python3 scripts/generate_finetune_dataset.py'
        )
        sys.exit(msg)
    if not val_jsonl.exists():
        sys.exit(f'ERROR: Validation data not found: {val_jsonl}')

    # ── Check HF token ─────────────────────────────────────────────────────
    hf_token = os.environ.get('HF_TOKEN', '')
    if not hf_token and 'gemma' in base_model.lower():
        sys.exit(
            'ERROR: HF_TOKEN environment variable required for Gemma 3 access.\n'
            'Get your token at https://huggingface.co/settings/tokens\n'
            'Then: export HF_TOKEN=hf_...'
        )

    # ── Import Unsloth (GPU-required, not imported at module level) ────────
    try:
        from unsloth import FastLanguageModel
        from unsloth import is_bfloat16_supported
        from trl import SFTTrainer, SFTConfig
        from datasets import load_dataset
    except ImportError as e:
        sys.exit(
            f'ERROR: {e}\n'
            'Install dependencies on RunPod:\n'
            '  pip install unsloth transformers datasets trl peft accelerate bitsandbytes'
        )

    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Load model with Unsloth ─────────────────────────────────────────
    print('\n[1] Loading base model...')
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name     = base_model,
        max_seq_length = max_seq_length,
        dtype          = None,             # Unsloth auto-detects bfloat16/float16
        load_in_4bit   = True,             # 4-bit QLoRA — ~50% VRAM vs full LoRA
        token          = hf_token,
    )

    # ── Attach LoRA adapters ─────────────────────────────────────────────
    print('[2] Attaching LoRA adapters...')
    model = FastLanguageModel.get_peft_model(
        model,
        r              = lora_r,
        target_modules = lora_targets,
        lora_alpha     = lora_alpha,
        lora_dropout   = lora_dropout,
        bias           = 'none',
        use_gradient_checkpointing = 'unsloth',
        random_state   = 42,
    )

    # ── Load dataset ─────────────────────────────────────────────────────
    print('[3] Loading dataset...')
    # JSONL is in ShareGPT format — each row has "conversations": [{"from": "human|gpt", "value": "..."}]
    dataset = load_dataset('json', data_files={
        'train': str(train_jsonl),
        'validation': str(val_jsonl),
    })

    def format_sharegpt(examples):
        """Convert ShareGPT conversations to HuggingFace messages format.

        Gemma 3 requires strictly alternating user/assistant roles.
        System messages are not a supported role — prepend to first user turn.
        ShareGPT role mapping: system→prepend, human→user, gpt→assistant.
        """
        texts = []
        for conversation in examples['conversations']:
            messages = []
            system_content = None
            for turn in conversation:
                role = turn.get('from', '')
                value = turn.get('value', '')
                if role == 'system':
                    system_content = value
                elif role == 'human':
                    # Prepend system prompt to the first user message only
                    if system_content:
                        value = f"{system_content}\n\n{value}"
                        system_content = None
                    messages.append({'role': 'user', 'content': value})
                elif role == 'gpt':
                    messages.append({'role': 'assistant', 'content': value})
            if not messages:
                continue
            formatted = tokenizer.apply_chat_template(
                messages,
                tokenize              = False,
                add_generation_prompt = False,
            )
            texts.append(formatted)
        return {'text': texts}

    dataset = dataset.map(format_sharegpt, batched=True)

    # ── Training ─────────────────────────────────────────────────────────
    print('[4] Starting training...')
    trainer_cfg = SFTConfig(
        output_dir                  = str(output_dir),
        num_train_epochs            = num_epochs,
        per_device_train_batch_size = batch_size,
        per_device_eval_batch_size  = batch_size,
        gradient_accumulation_steps = grad_accum,
        learning_rate               = learning_rate,
        weight_decay                = weight_decay,
        warmup_ratio                = warmup_ratio,
        lr_scheduler_type           = lr_schedule,
        max_grad_norm               = max_grad_norm,
        bf16                        = bf16 and is_bfloat16_supported(),
        fp16                        = not (bf16 and is_bfloat16_supported()),
        logging_steps               = 20,
        eval_strategy               = 'steps',
        eval_steps                  = eval_steps,
        save_strategy               = 'steps',
        save_steps                  = save_steps,
        save_total_limit            = save_total_limit,
        load_best_model_at_end      = True,
        metric_for_best_model       = 'eval_loss',
        greater_is_better           = False,
        report_to                   = 'none',     # swap to 'wandb' if desired
        dataset_text_field          = 'text',
        max_seq_length              = max_seq_length,
        packing                     = True,       # sequence packing for ~3× throughput
    )

    from transformers import EarlyStoppingCallback
    trainer = SFTTrainer(
        model        = model,
        tokenizer    = tokenizer,
        train_dataset= dataset['train'],
        eval_dataset = dataset['validation'],
        args         = trainer_cfg,
        callbacks    = [EarlyStoppingCallback(early_stopping_patience=early_stop_pat)],
    )

    trainer_stats = trainer.train()
    print(f'\n✓ Training complete.\n  Loss: {trainer_stats.training_loss:.4f}')
    print(f'  Steps: {trainer_stats.global_step}')
    print(f'  Runtime: {trainer_stats.metrics.get("train_runtime", 0):.0f}s')

    # ── Save adapter ─────────────────────────────────────────────────────
    adapter_dir = output_dir / 'adapter'
    adapter_dir.mkdir(exist_ok=True)
    model.save_pretrained(str(adapter_dir))
    tokenizer.save_pretrained(str(adapter_dir))
    print(f'\n✓ Adapter saved to {adapter_dir}')

    # ── Optional: merge weights into full model ──────────────────────────
    if merge_weights:
        print('\n[5] Merging LoRA weights into base model...')
        merged_dir = output_dir / 'merged'
        model.save_pretrained_merged(
            str(merged_dir),
            tokenizer,
            save_method = 'merged_16bit',
        )
        print(f'✓ Merged model saved to {merged_dir}')

        # Export to GGUF Q4_K_M (for CPU / GGUF runtime fallback)
        gguf_dir = output_dir / 'gguf'
        print(f'[6] Exporting GGUF Q4_K_M (for llama.cpp / llama.rn fallback)...')
        print(f'    NOTE: Use Indic calibration data for best Hindi quality.')
        print(f'    See: https://github.com/ggml-org/llama.cpp#quantize')
        print(f'    Command:')
        gguf_name = f'{variant_id}-Q4_K_M.gguf'
        print(f'      llama.cpp/llama-quantize {merged_dir}/model.safetensors '
              f'{gguf_dir}/{gguf_name} Q4_K_M')
        print(f'    Use calibration data:')
        print(f'      --calibration-data training_data/dhanwantari_train.jsonl')
        print(f'    (Indic/Hindi calibration improves Hindi quality by up to 3.52 perplexity points)')

    # ── Next steps ────────────────────────────────────────────────────────
    print('\n── Next Steps ──────────────────────────────────────────')
    if language == 'en':
        print(f'1. Test adapter: load from {adapter_dir}')
        print(f'2. Merge weights: re-run with --merge')
        print(f'3. Quantize GGUF: llama.cpp quantize with Indic calibration data')
        print(f'4. Export LiteRT .bin: use ai-edge-torch (see docs/export_litert.md)')
        print(f'5. Upload to S3: models/{variant_id}-<date>.bin')
        print(f'6. Fill in sha256 in sync/model_variants.json')
        print(f'7. Create pending_model_update.json and run bedrock_sync_agent.py')
        print(f'')
        print(f'Language packs: train a ~40MB language adapter on top for each language:')
        print(f'  python3 training/train.py --variant {variant_id} --language hi')
        print(f'  python3 training/train.py --variant {variant_id} --language or')
    else:
        print(f'1. Adapter saved to {adapter_dir}  (~40MB)')
        print(f'2. Upload adapter to S3: models/lang/{language}/{variant_id}-lang-{language}-adapter/')
        print(f'3. Update sync/model_variants.json language_packs.{language}.adapter_version')
        print(f'4. Create translation sidecar: assets/translations/{language}/disease_translations.json')
        print(f'   Contains: disease names, symptom names, medicine names, test names in {language}')
        print(f'   Size: ~2–5 MB. Download independently of the adapter.')
        print(f'5. App downloads: base model (once) + {language} adapter (~40MB) + translation JSON (~3MB)')


# ══════════════════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='DhanwantariAI unified fine-tuning script',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Validate config without GPU:
    python3 training/train.py --variant 1b --dry-run
    python3 training/train.py --variant 1b --language hi --dry-run

  Train base 1B model:
    HF_TOKEN=hf_... python3 training/train.py --variant 1b

  Train Hindi language-pack adapter:
    HF_TOKEN=hf_... python3 training/train.py --variant 1b --language hi
    (requires training_data/lang/hi/train.jsonl + val.jsonl in Hindi)

  Train Odia language-pack adapter:
    HF_TOKEN=hf_... python3 training/train.py --variant 1b --language or

  Train 4B + merge weights:
    HF_TOKEN=hf_... python3 training/train.py --variant 4b --merge

  Train on custom data:
    TRAIN_JSONL=/data/train.jsonl VAL_JSONL=/data/val.jsonl \\
    python3 training/train.py --variant 1b --language hi
        """
    )
    parser.add_argument(
        '--variant',
        required = True,
        help     = 'Model variant id (from sync/model_variants.json), '
                   'e.g. gemma3-1b or gemma3-4b',
    )
    parser.add_argument(
        '--dry-run',
        action  = 'store_true',
        help    = 'Validate config and print settings without actually training',
    )
    parser.add_argument(
        '--merge',
        action  = 'store_true',
        help    = 'After training, merge LoRA adapter into base model weights',
    )
    parser.add_argument(
        '--language', '-L',
        default = 'en',
        metavar = 'LANG',
        help    = 'Language code for a language-pack adapter (default: en). '
                  'Training data must be in training_data/lang/<LANG>/. '
                  'Output adapter goes to training/output/<variant>/lang-<LANG>/adapter/. '
                  'Examples: hi (Hindi), or (Odia), mr (Marathi), kn (Kannada)',
    )
    args = parser.parse_args()

    # Accept shorthands: '1b' → 'gemma3-1b-dhanwantari-ft', '4b' → 'gemma3-4b-dhanwantari-ft'
    _shorthands = {
        '1b':       'gemma3-1b-dhanwantari-ft',
        'gemma3-1b':'gemma3-1b-dhanwantari-ft',
        '4b':       'gemma3-4b-dhanwantari-ft',
        'gemma3-4b':'gemma3-4b-dhanwantari-ft',
    }
    variant_id = _shorthands.get(args.variant, args.variant)

    train(variant_id, language=args.language, dry_run=args.dry_run, merge_weights=args.merge)
