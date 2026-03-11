import {createApi, BaseQueryFn} from '@reduxjs/toolkit/query/react';
import axios, {AxiosError, AxiosRequestConfig} from 'axios';
import {LLMRequest, LLMResponse} from '@store/types';

// Default to local llama.cpp server; override in Settings
export const LLM_BASE_URL_DEFAULT = 'http://localhost:8080';

const axiosBaseQuery =
  (
    baseUrl: string,
  ): BaseQueryFn<
    {url: string; method?: AxiosRequestConfig['method']; data?: unknown},
    unknown,
    unknown
  > =>
  async ({url, method = 'POST', data}) => {
    try {
      const result = await axios({
        url: baseUrl + url,
        method,
        data,
        timeout: 30000,
        headers: {'Content-Type': 'application/json'},
      });
      return {data: result.data};
    } catch (axiosError) {
      const err = axiosError as AxiosError;
      return {
        error: {
          status: err.response?.status,
          data: err.response?.data || err.message,
        },
      };
    }
  };

export const llmApi = createApi({
  reducerPath: 'llmApi',
  baseQuery: axiosBaseQuery(LLM_BASE_URL_DEFAULT),
  endpoints: builder => ({
    chatCompletion: builder.mutation<LLMResponse, LLMRequest>({
      query: body => ({
        url: '/v1/chat/completions',
        method: 'POST',
        data: body,
      }),
    }),
    healthCheck: builder.query<{status: string}, void>({
      query: () => ({url: '/health', method: 'GET'}),
    }),
  }),
});

export const {useChatCompletionMutation, useHealthCheckQuery} = llmApi;
