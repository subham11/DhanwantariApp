/*
 * Stub RuntimeAdapter.h for compatibility with react-native-reanimated on
 * React Native 0.74+ where hermes/inspector/ was replaced by hermes/cdp/.
 *
 * Registration.h (from both react-native and React-Core-prebuilt) includes
 * this file and then declares enableDebugging/disableDebugging in namespace
 * facebook::hermes::inspector_modern::chrome using RuntimeAdapter unqualified.
 * That unqualified lookup resolves to facebook::hermes::inspector_modern so
 * that is where the class must be declared.
 *
 * ReanimatedHermesRuntime.cpp also does:
 *   using namespace facebook::hermes::inspector_modern;
 *   class HermesExecutorRuntimeAdapter : public RuntimeAdapter { ... }
 * which confirms inspector_modern is the correct namespace.
 */

#pragma once

#include <hermes/hermes.h>

namespace facebook {
namespace hermes {
namespace inspector_modern {

class RuntimeAdapter {
 public:
  virtual ~RuntimeAdapter() = default;
  virtual facebook::hermes::HermesRuntime& getRuntime() = 0;
  virtual void tickleJs() {}
};

} // namespace inspector_modern
} // namespace hermes
} // namespace facebook
