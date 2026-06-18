/** Ported verbatim from sim/apps/sim/blocks/blocks/api.ts. */
import { ApiIcon } from '../../../components/icons'
import { IntegrationType } from '../../types'
import { defineCk8tBlock } from '../../ck8t-block-base.js'

export const ApiBlock = defineCk8tBlock({
  type: 'api',
  name: 'API',
  description: 'Use any API',
  longDescription:
    'Connect to any external API with support for all standard HTTP methods and customizable request parameters.',
  docsLink: 'https://docs.sim.ai/blocks/api',
  category: 'tools',
  integrationType: IntegrationType.DeveloperTools,
  tags: ['automation', 'webhooks'],
  bgColor: '#2F55FF',
  icon: ApiIcon,
  subBlocks: [
    { id: 'url', title: 'URL', type: 'short-input', placeholder: 'Enter URL', required: true },
    {
      id: 'method',
      title: 'Method',
      type: 'dropdown',
      required: true,
      options: [
        { label: 'GET', id: 'GET' },
        { label: 'POST', id: 'POST' },
        { label: 'PUT', id: 'PUT' },
        { label: 'DELETE', id: 'DELETE' },
        { label: 'PATCH', id: 'PATCH' },
      ],
    },
    { id: 'params', title: 'Query Params', type: 'table', columns: ['Key', 'Value'] },
    { id: 'headers', title: 'Headers', type: 'table', columns: ['Key', 'Value'] },

    // ── Authorization ──────────────────────────────────────────────────────────
    {
      id: 'authorization',
      title: 'Authorization',
      type: 'dropdown',
      value: () => 'none',
      options: [
        { label: 'None', id: 'none' },
        { label: 'Bearer Token', id: 'bearer' },
        { label: 'API Key', id: 'api_key' },
        { label: 'Basic Auth', id: 'basic' },
      ],
    },
    {
      id: 'authToken',
      title: 'Token',
      type: 'short-input',
      placeholder: 'Enter bearer token',
      condition: { field: 'authorization', value: 'bearer' },
    },
    {
      id: 'authApiKeyName',
      title: 'Key Name',
      type: 'short-input',
      placeholder: 'e.g. Api-Key, X-API-Key',
      condition: { field: 'authorization', value: 'api_key' },
    },
    {
      id: 'authApiKeyValue',
      title: 'Key Value',
      type: 'short-input',
      placeholder: 'Enter key value',
      condition: { field: 'authorization', value: 'api_key' },
    },
    {
      id: 'authApiKeyIn',
      title: 'Send In',
      type: 'dropdown',
      value: () => 'header',
      options: [
        { label: 'Header', id: 'header' },
        { label: 'Query Param', id: 'query' },
      ],
      condition: { field: 'authorization', value: 'api_key' },
    },
    {
      id: 'authUsername',
      title: 'Username',
      type: 'short-input',
      placeholder: 'Username',
      condition: { field: 'authorization', value: 'basic' },
    },
    {
      id: 'authPassword',
      title: 'Password',
      type: 'short-input',
      placeholder: 'Password',
      password: true,
      condition: { field: 'authorization', value: 'basic' },
    },

    // ── Body ──────────────────────────────────────────────────────────────────
    {
      id: 'contentType',
      title: 'Body Type',
      type: 'dropdown',
      value: () => 'application/json',
      options: [
        { label: 'JSON (application/json)', id: 'application/json' },
        { label: 'Form Data (multipart/form-data)', id: 'multipart/form-data' },
        { label: 'URL Encoded (application/x-www-form-urlencoded)', id: 'application/x-www-form-urlencoded' },
        { label: 'Text (text/plain)', id: 'text/plain' },
        { label: 'None', id: 'none' },
      ],
    },
    {
      id: 'body',
      title: 'Body',
      type: 'code',
      placeholder: 'Enter JSON...',
      language: 'json',
      // Show body JSON editor when contentType is explicitly json OR when it hasn't
      // been set yet (backwards-compat: existing blocks that predate the contentType field).
      condition: (v) => !v.contentType || v.contentType === 'application/json',
    },
    {
      id: 'bodyFormData',
      title: 'Form Fields',
      type: 'table',
      columns: ['Key', 'Value'],
      condition: { field: 'contentType', value: ['multipart/form-data', 'application/x-www-form-urlencoded'] },
    },
    {
      id: 'bodyText',
      title: 'Body',
      type: 'long-input',
      placeholder: 'Enter text...',
      condition: { field: 'contentType', value: 'text/plain' },
    },

    {
      id: 'timeout',
      title: 'Timeout (ms)',
      type: 'short-input',
      placeholder: '300000',
      mode: 'advanced',
    },
    { id: 'retries', title: 'Retries', type: 'short-input', placeholder: '0', mode: 'advanced' },
    {
      id: 'retryDelayMs',
      title: 'Retry delay (ms)',
      type: 'short-input',
      placeholder: '500',
      mode: 'advanced',
    },
    {
      id: 'retryMaxDelayMs',
      title: 'Max retry delay (ms)',
      type: 'short-input',
      placeholder: '30000',
      mode: 'advanced',
    },
    {
      id: 'retryNonIdempotent',
      title: 'Retry non-idempotent methods',
      type: 'switch',
      mode: 'advanced',
    },
  ],
  tools: { access: ['http_request'] },
  inputs: {
    url: { type: 'string', description: 'Request URL' },
    method: { type: 'string', description: 'HTTP method' },
    headers: { type: 'json', description: 'Request headers' },
    body: { type: 'json', description: 'Request body (JSON mode)' },
    bodyFormData: { type: 'json', description: 'Form fields (form-data or url-encoded mode)' },
    params: { type: 'json', description: 'URL query parameters' },
    authorization: { type: 'string', description: 'Authorization type (none/bearer/api_key/basic)' },
    authToken: { type: 'string', description: 'Bearer token' },
    authApiKeyName: { type: 'string', description: 'API key header or query param name' },
    authApiKeyValue: { type: 'string', description: 'API key value' },
    contentType: { type: 'string', description: 'Body content type' },
    timeout: { type: 'number', description: 'Request timeout in milliseconds' },
    retries: { type: 'number', description: 'Number of retry attempts' },
    retryDelayMs: { type: 'number', description: 'Initial retry delay' },
    retryMaxDelayMs: { type: 'number', description: 'Maximum retry delay' },
    retryNonIdempotent: { type: 'boolean', description: 'Allow retries for POST/PATCH' },
  },
  outputs: {
    data: { type: 'json', description: 'API response data' },
    status: { type: 'number', description: 'HTTP status code' },
    headers: { type: 'json', description: 'HTTP response headers' },
  },
})
