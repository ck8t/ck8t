/**
 * AI Providers panel — Daakia-style provider configuration.
 * Ditto design: provider cards with toggle, brand icon, model pills,
 * API key management, expand/collapse, default selection.
 */
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useAiProvidersStore } from '../stores/ai-providers-store'
import { fetchAvailableProviders } from '../api/llm-provider-client'
import { AI_PROVIDERS } from '../ai/ai-providers'

/* ── Theme constants (dark mode) ───────────────────────────── */
const C = {
  textPrimary: '#e2e8f0',
  textMuted:   '#94a3b8',
  textError:   '#fca5a5',
  ai:          '#6366f1',
  bg:          'transparent',
  inputBg:     'rgba(255,255,255,0.05)',
  inputBorder: 'rgba(255,255,255,0.10)',
}

/* ── Brand colors per provider ────────────────────────────── */
const BRAND = {
  openai:         '#10a37f',
  anthropic:      '#d97706',
  google:         '#3186FF',
  ollama:         '#64748b',
  groq:           '#F55036',
  together:       '#0f3460',
  mistral:        '#FF8205',
  xai:            '#a1a1aa',
  deepseek:       '#4D6BFE',
  'azure-openai': '#0078d4',
  copilot:        '#6e7bf9',
}

/* ── Brand icons (exact Daakia implementations) ───────────── */
const OpenAiIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#10a37f" />
    <path fillRule="evenodd" fill="white"
      d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"
    />
  </svg>
)

const AnthropicIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="white" />
    <path fillRule="nonzero" fill="#D97757"
      d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
    />
  </svg>
)

const GeminiIcon = ({ size = 20 }) => {
  const star = 'M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="5.5" fill="white" />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id="ck8t-gem-g0" x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" /><stop offset="1" stopColor="#08B962" stopOpacity={0} />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id="ck8t-gem-g1" x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" /><stop offset="1" stopColor="#F94543" stopOpacity={0} />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id="ck8t-gem-g2" x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" /><stop offset=".46" stopColor="#FABC12" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={star} fill="#3186FF" />
      <path d={star} fill="url(#ck8t-gem-g0)" />
      <path d={star} fill="url(#ck8t-gem-g1)" />
      <path d={star} fill="url(#ck8t-gem-g2)" />
    </svg>
  )
}

const DeepSeekIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="white" />
    <path fill="#4D6BFE"
      d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"
    />
  </svg>
)

const XaiIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#18181b" />
    <path fillRule="evenodd" fill="white"
      d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"
    />
  </svg>
)

const GroqIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#18181b" />
    <path fillRule="evenodd" fill="white"
      d="M12.036 2c-3.853-.035-7 3-7.036 6.781-.035 3.782 3.055 6.872 6.908 6.907h2.42v-2.566h-2.292c-2.407.028-4.38-1.866-4.408-4.23-.029-2.362 1.901-4.298 4.308-4.326h.1c2.407 0 4.358 1.915 4.365 4.278v6.305c0 2.342-1.944 4.25-4.323 4.279a4.375 4.375 0 01-3.033-1.252l-1.851 1.818A7 7 0 0012.029 22h.092c3.803-.056 6.858-3.083 6.879-6.816v-6.5C18.907 4.963 15.817 2 12.036 2z"
    />
  </svg>
)

const TogetherIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#0D0D0D" />
    <path d="M23.197 4.503A6 6 0 0015 2.307a5.973 5.973 0 00-2.995 4.933l5.996.008v.515h-5.996c.039.937.298 1.87.8 2.74a6 6 0 1010.39-6z" fill="#EF2CC1" />
    <path d="M.805 4.5A6 6 0 003 12.697a5.972 5.972 0 005.77.127L5.779 7.627l.446-.257 2.997 5.192A6 6 0 10.804 4.5z" fill="#CAAEF5" />
    <path d="M12 23.894a6 6 0 005.999-6c0-2.13-1.1-3.996-2.775-5.06l-3.005 5.189-.444-.258 2.997-5.192A6 6 0 1012 23.894z" fill="#FC4C02" />
  </svg>
)

const MistralIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#18181b" />
    <path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold" />
    <path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#FFAF00" />
    <path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205" />
    <path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#FA500F" />
    <path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#E10500" />
  </svg>
)

const OllamaIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#18181b" />
    <path fillRule="evenodd" fill="white"
      d="M7.905 1.09c.216.085.411.225.588.41.295.306.544.744.734 1.263.191.522.315 1.1.362 1.68a5.054 5.054 0 012.049-.636l.051-.004c.87-.07 1.73.087 2.48.474.101.053.2.11.297.17.05-.569.172-1.134.36-1.644.19-.52.439-.957.733-1.264a1.67 1.67 0 01.589-.41c.257-.1.53-.118.796-.042.401.114.745.368 1.016.737.248.337.434.769.561 1.287.23.934.27 2.163.115 3.645l.053.04.026.019c.757.576 1.284 1.397 1.563 2.35.435 1.487.216 3.155-.534 4.088l-.018.021.002.003c.417.762.67 1.567.724 2.4l.002.03c.064 1.065-.2 2.137-.814 3.19l-.007.01.01.024c.472 1.157.62 2.322.438 3.486l-.006.039a.651.651 0 01-.747.536.648.648 0 01-.54-.742c.167-1.033.01-2.069-.48-3.123a.643.643 0 01.04-.617l.004-.006c.604-.924.854-1.83.8-2.72-.046-.779-.325-1.544-.8-2.273a.644.644 0 01.18-.886l.009-.006c.243-.159.467-.565.58-1.12a4.229 4.229 0 00-.095-1.974c-.205-.7-.58-1.284-1.105-1.683-.595-.454-1.383-.673-2.38-.61a.653.653 0 01-.632-.371c-.314-.665-.772-1.141-1.343-1.436a3.288 3.288 0 00-1.772-.332c-1.245.099-2.343.801-2.67 1.686a.652.652 0 01-.61.425c-1.067.002-1.893.252-2.497.703-.522.39-.878.935-1.066 1.588a4.07 4.07 0 00-.068 1.886c.112.558.331 1.02.582 1.269l.008.007c.212.207.257.53.109.785-.36.622-.629 1.549-.673 2.44-.05 1.018.186 1.902.719 2.536l.016.019a.643.643 0 01.095.69c-.576 1.236-.753 2.252-.562 3.052a.652.652 0 01-1.269.298c-.243-1.018-.078-2.184.473-3.498l.014-.035-.008-.012a4.339 4.339 0 01-.598-1.309l-.005-.019a5.764 5.764 0 01-.177-1.785c.044-.91.278-1.842.622-2.59l.012-.026-.002-.002c-.293-.418-.51-.953-.63-1.545l-.005-.024a5.352 5.352 0 01.093-2.49c.262-.915.777-1.701 1.536-2.269.06-.045.123-.09.186-.132-.159-1.493-.119-2.73.112-3.67.127-.518.314-.95.562-1.287.27-.368.614-.622 1.015-.737.266-.076.54-.059.797.042zm4.116 9.09c.936 0 1.8.313 2.446.855.63.527 1.005 1.235 1.005 1.94 0 .888-.406 1.58-1.133 2.022-.62.375-1.451.557-2.403.557-1.009 0-1.871-.259-2.493-.734-.617-.47-.963-1.13-.963-1.845 0-.707.398-1.417 1.056-1.946.668-.537 1.55-.849 2.485-.849zm0 .896a3.07 3.07 0 00-1.916.65c-.461.37-.722.835-.722 1.25 0 .428.21.829.61 1.134.455.347 1.124.548 1.943.548.799 0 1.473-.147 1.932-.426.463-.28.7-.686.7-1.257 0-.423-.246-.89-.683-1.256-.484-.405-1.14-.643-1.864-.643zm.662 1.21l.004.004c.12.151.095.37-.056.49l-.292.23v.446a.375.375 0 01-.376.373.375.375 0 01-.376-.373v-.46l-.271-.218a.347.347 0 01-.052-.49.353.353 0 01.494-.051l.215.172.22-.174a.353.353 0 01.49.051zm-5.04-1.919c.478 0 .867.39.867.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zm8.706 0c.48 0 .868.39.868.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zM7.44 2.3l-.003.002a.659.659 0 00-.285.238l-.005.006c-.138.189-.258.467-.348.832-.17.692-.216 1.631-.124 2.782.43-.128.899-.208 1.404-.237l.01-.001.019-.034c.046-.082.095-.161.148-.239.123-.771.022-1.692-.253-2.444-.134-.364-.297-.65-.453-.813a.628.628 0 00-.107-.09L7.44 2.3zm9.174.04l-.002.001a.628.628 0 00-.107.09c-.156.163-.32.45-.453.814-.29.794-.387 1.776-.23 2.572l.058.097.008.014h.03a5.184 5.184 0 011.466.212c.086-1.124.038-2.043-.128-2.722-.09-.365-.21-.643-.349-.832l-.004-.006a.659.659 0 00-.285-.239h-.004z"
    />
  </svg>
)

const AzureIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="white" />
    <defs>
      <linearGradient gradientUnits="userSpaceOnUse" id="ck8t-az-g0" x1="18.242" x2="14.191" y1="16.837" y2=".616">
        <stop stopColor="#712575" /><stop offset=".09" stopColor="#9A2884" /><stop offset=".18" stopColor="#BF2C92" />
        <stop offset=".27" stopColor="#DA2E9C" /><stop offset=".34" stopColor="#EB30A2" /><stop offset=".4" stopColor="#F131A5" />
        <stop offset=".5" stopColor="#EC30A3" /><stop offset=".61" stopColor="#DF2F9E" /><stop offset=".72" stopColor="#C92D96" />
        <stop offset=".83" stopColor="#AA2A8A" /><stop offset=".95" stopColor="#83267C" /><stop offset="1" stopColor="#712575" />
      </linearGradient>
      <linearGradient gradientUnits="userSpaceOnUse" id="ck8t-az-g1" x1="19.782" x2="19.782" y1=".34" y2="23.222">
        <stop stopColor="#DA7ED0" /><stop offset=".08" stopColor="#B17BD5" /><stop offset=".19" stopColor="#8778DB" />
        <stop offset=".3" stopColor="#6276E1" /><stop offset=".41" stopColor="#4574E5" /><stop offset=".54" stopColor="#2E72E8" />
        <stop offset=".67" stopColor="#1D71EB" /><stop offset=".81" stopColor="#1471EC" /><stop offset="1" stopColor="#1171ED" />
      </linearGradient>
      <linearGradient gradientUnits="userSpaceOnUse" id="ck8t-az-g2" x1="18.404" x2="3.236" y1=".859" y2="25.183">
        <stop stopColor="#DA7ED0" /><stop offset=".05" stopColor="#B77BD4" /><stop offset=".11" stopColor="#9079DA" />
        <stop offset=".18" stopColor="#6E77DF" /><stop offset=".25" stopColor="#5175E3" /><stop offset=".33" stopColor="#3973E7" />
        <stop offset=".42" stopColor="#2772E9" /><stop offset=".54" stopColor="#1A71EB" /><stop offset=".68" stopColor="#1371EC" />
        <stop offset="1" stopColor="#1171ED" />
      </linearGradient>
    </defs>
    <path clipRule="evenodd" fillRule="evenodd" fill="url(#ck8t-az-g0)"
      d="M16.233 0c.713 0 1.345.551 1.572 1.329.227.778 1.555 5.59 1.555 5.59v9.562h-4.813L14.645 0h1.588z" />
    <path fill="url(#ck8t-az-g1)"
      d="M23.298 7.47c0-.34-.275-.6-.6-.6h-2.835a3.617 3.617 0 00-3.614 3.615v5.996h3.436a3.617 3.617 0 003.613-3.614V7.47z" />
    <path clipRule="evenodd" fillRule="evenodd" fill="url(#ck8t-az-g2)"
      d="M16.233 0a.982.982 0 00-.989.989l-.097 18.198A4.814 4.814 0 0110.334 24H1.6a.597.597 0 01-.567-.794l7-19.981A4.819 4.819 0 0112.57 0h3.679-.016z" />
  </svg>
)

const CopilotIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="white" />
    <path
      d="M19.245 5.364c1.322 1.36 1.877 3.216 2.11 5.817.622 0 1.2.135 1.592.654l.73.964c.21.278.323.61.323.955v2.62c0 .339-.173.669-.453.868C20.239 19.602 16.157 21.5 12 21.5c-4.6 0-9.205-2.583-11.547-4.258-.28-.2-.452-.53-.453-.868v-2.62c0-.345.113-.679.321-.956l.73-.963c.392-.517.974-.654 1.593-.654l.029-.297c.25-2.446.81-4.213 2.082-5.52 2.461-2.54 5.71-2.851 7.146-2.864h.198c1.436.013 4.685.323 7.146 2.864zm-7.244 4.328c-.284 0-.613.016-.962.05-.123.447-.305.85-.57 1.108-1.05 1.023-2.316 1.18-2.994 1.18-.638 0-1.306-.13-1.851-.464-.516.165-1.012.403-1.044.996a65.882 65.882 0 00-.063 2.884l-.002.48c-.002.563-.005 1.126-.013 1.69.002.326.204.63.51.765 2.482 1.102 4.83 1.657 6.99 1.657 2.156 0 4.504-.555 6.985-1.657a.854.854 0 00.51-.766c.03-1.682.006-3.372-.076-5.053-.031-.596-.528-.83-1.046-.996-.546.333-1.212.464-1.85.464-.677 0-1.942-.157-2.993-1.18-.266-.258-.447-.661-.57-1.108-.32-.032-.64-.049-.96-.05zm-2.525 4.013c.539 0 .976.426.976.95v1.753c0 .525-.437.95-.976.95a.964.964 0 01-.976-.95v-1.752c0-.525.437-.951.976-.951zm5 0c.539 0 .976.426.976.95v1.753c0 .525-.437.95-.976.95a.964.964 0 01-.976-.95v-1.752c0-.525.437-.951.976-.951zM7.635 5.087c-1.05.102-1.935.438-2.385.906-.975 1.037-.765 3.668-.21 4.224.405.394 1.17.657 1.995.657h.09c.649-.013 1.785-.176 2.73-1.11.435-.41.705-1.433.675-2.47-.03-.834-.27-1.52-.63-1.813-.39-.336-1.275-.482-2.265-.394zm6.465.394c-.36.292-.6.98-.63 1.813-.03 1.037.24 2.06.675 2.47.968.957 2.136 1.104 2.776 1.11h.044c.825 0 1.59-.263 1.995-.657.555-.556.765-3.187-.21-4.224-.45-.468-1.335-.804-2.385-.906-.99-.088-1.875.058-2.265.394zM12 7.615c-.24 0-.525.015-.84.044.03.16.045.336.06.526l-.001.159a2.94 2.94 0 01-.014.25c.225-.022.425-.027.612-.028h.366c.187 0 .387.006.612.028-.015-.146-.015-.277-.015-.409.015-.19.03-.365.06-.526a9.29 9.29 0 00-.84-.044z"
      fill="#18181b"
    />
  </svg>
)

const BRAND_ICON = {
  openai:         OpenAiIcon,
  anthropic:      AnthropicIcon,
  google:         GeminiIcon,
  ollama:         OllamaIcon,
  groq:           GroqIcon,
  together:       TogetherIcon,
  mistral:        MistralIcon,
  xai:            XaiIcon,
  deepseek:       DeepSeekIcon,
  'azure-openai': AzureIcon,
  copilot:        CopilotIcon,
}

const NO_KEY_PROVIDERS = new Set(['copilot', 'ollama'])

/* ── Reusable sub-components ──────────────────────────────── */

function MiniToggle({ value, onChange, accent }) {
  const color = accent || C.ai
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 9999, cursor: 'pointer',
        flexShrink: 0, position: 'relative', border: 'none',
        backgroundColor: value ? color : 'rgba(255,255,255,0.15)',
        transition: 'background-color 0.15s',
      }}
      title={value ? 'Enabled — click to disable' : 'Disabled — click to enable'}
    >
      <span style={{
        position: 'absolute', top: 3, width: 14, height: 14,
        borderRadius: '50%', background: 'white',
        left: value ? 19 : 3, transition: 'left 0.15s',
      }} />
    </button>
  )
}

function InlineInput({ value, onChange, placeholder, style }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: C.inputBg,
        border: `1px solid ${C.inputBorder}`,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 11,
        color: C.textPrimary,
        outline: 'none',
        fontFamily: 'inherit',
        ...style,
      }}
    />
  )
}

/* ── API Key Manager ──────────────────────────────────────── */

function ApiKeyManager({ providerId }) {
  // Subscribe to the actual boolean value so the component re-renders when key status changes
  const stored  = useAiProvidersStore((s) => s.providers.find((p) => p.id === providerId)?.hasKey ?? false)
  const saveKey = useAiProvidersStore((s) => s.saveKey)
  const delKey  = useAiProvidersStore((s) => s.deleteKey)
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  const handleSave = () => {
    if (draft.trim()) { saveKey(providerId, draft.trim()); setDraft(''); setEditing(false) }
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          placeholder="Paste API key…"
          autoFocus
          style={{
            flex: 1, height: 26, background: C.inputBg, border: `1px solid ${C.inputBorder}`,
            borderRadius: 6, padding: '0 8px', fontSize: 11, color: C.textPrimary,
            outline: 'none', fontFamily: 'monospace',
          }}
        />
        <button type="button" onClick={handleSave} style={{ padding: '2px 8px', fontSize: 11, borderRadius: 6, border: 'none', backgroundColor: C.ai, color: 'white', cursor: 'pointer' }}>Save</button>
        <button type="button" onClick={() => { setEditing(false); setDraft('') }} style={{ padding: '2px 8px', fontSize: 11, borderRadius: 6, border: 'none', background: 'transparent', color: C.textMuted, cursor: 'pointer' }}>Cancel</button>
      </div>
    )
  }

  if (confirmDel) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11 }}>
        <span style={{ color: C.textError }}>Remove API key?</span>
        <button type="button" onClick={() => { delKey(providerId); setConfirmDel(false) }} style={{ padding: '1px 8px', fontSize: 11, borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' }}>Yes</button>
        <button type="button" onClick={() => setConfirmDel(false)} style={{ padding: '1px 8px', fontSize: 11, borderRadius: 6, border: 'none', background: 'transparent', color: C.textMuted, cursor: 'pointer' }}>No</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stored ? C.ai : C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
      {stored ? (
        <>
          <span style={{ fontSize: 11, color: C.textMuted }}>API key stored</span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4, backgroundColor: `color-mix(in srgb, ${C.ai} 10%, transparent)`, color: C.ai }}>••••••••</span>
          <button type="button" onClick={() => setEditing(true)} style={{ fontSize: 11, border: 'none', background: 'transparent', color: C.ai, cursor: 'pointer' }}>Update</button>
          <button type="button" onClick={() => setConfirmDel(true)} style={{ fontSize: 11, border: 'none', background: 'transparent', color: C.textError, cursor: 'pointer' }}>Remove</button>
        </>
      ) : (
        <button type="button" onClick={() => setEditing(true)} style={{ fontSize: 11, border: 'none', background: 'transparent', color: C.ai, cursor: 'pointer' }}>+ Add API key</button>
      )}
    </div>
  )
}

/* ── Model Pills ──────────────────────────────────────────── */

function CheckIcon({ size = 9, accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ModelPills({ models, accent, selectedModelId, onPillClick }) {
  if (!models.length) return <p style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic', margin: 0 }}>No models</p>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
      {models.map((m) => {
        const isSel = m.id === selectedModelId
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onPillClick?.(m.id, m.name)}
            title={isSel ? `${m.name} — default` : m.name}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10, padding: '2px 8px', borderRadius: 9999,
              cursor: 'pointer', fontFamily: 'monospace', transition: 'all 0.1s',
              ...(isSel
                ? { backgroundColor: '#0a0a0a', color: '#fff', border: `1.5px solid ${accent}`, fontWeight: 600 }
                : m.enabled
                ? { backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent, border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)` }
                : { backgroundColor: 'transparent', color: C.textMuted, border: '1px solid rgba(255,255,255,0.12)', opacity: 0.5 }
              ),
            }}
          >
            {isSel && <CheckIcon size={9} accent={accent} />}
            <span>{m.name}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ── Radio Select icon ────────────────────────────────────── */

function RadioIcon({ selected, size = 13, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || C.textMuted} strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      {selected && <circle cx="12" cy="12" r="5" fill={color || C.textMuted} />}
    </svg>
  )
}

/* ── Model Row (expanded list view) ──────────────────────── */

function ModelRow({ model, providerId, onDelete, isSelected, onSelect, accent }) {
  const updateModel = useAiProvidersStore((s) => s.updateModel)
  const toggleModel = useAiProvidersStore((s) => s.toggleModel)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      <div style={{ width: 14 }} />
      <MiniToggle value={model.enabled} onChange={() => toggleModel(providerId, model.id)} accent={accent} />
      <InlineInput value={model.name} onChange={(v) => updateModel(providerId, model.id, { name: v })} placeholder="Display name" style={{ width: 140, height: 26 }} />
      <InlineInput value={model.id} onChange={(v) => updateModel(providerId, model.id, { id: v })} placeholder="model-id" style={{ flex: 1, height: 26, fontFamily: 'monospace', fontSize: 11 }} />
      <button
        type="button"
        onClick={model.enabled ? onSelect : undefined}
        disabled={!model.enabled}
        title={!model.enabled ? 'Enable first' : isSelected ? 'Default model' : 'Set as default'}
        style={{ padding: 4, border: 'none', background: 'transparent', cursor: model.enabled ? 'pointer' : 'not-allowed', color: isSelected ? accent : C.textMuted, opacity: isSelected ? 1 : 0.4, flexShrink: 0 }}
      >
        <RadioIcon selected={isSelected} size={13} color={isSelected ? accent : undefined} />
      </button>
      <button type="button" onClick={onDelete} style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: C.textError, opacity: 0.6 }} title="Delete model">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
        </svg>
      </button>
    </div>
  )
}

/* ── Provider Card ────────────────────────────────────────── */

function ProviderCard({ provider }) {
  const {
    updateProvider, toggleProvider, removeProvider,
    toggleModel, addModel, removeModel, setDefaultProvider,
  } = useAiProvidersStore()
  const defaultProviderId = useAiProvidersStore((s) => s.defaultProviderId)
  const defaultModelId    = useAiProvidersStore((s) => s.defaultModelId)
  const [expanded,  setExpanded]  = useState(false)
  const [viewMode,  setViewMode]  = useState('pills')
  const [delTarget, setDelTarget] = useState(null)

  const accent  = BRAND[provider.id] || C.ai
  const BrandIc = BRAND_ICON[provider.id] || null
  const isDefault = defaultProviderId === provider.id

  const handleSetDefault = useCallback((e) => {
    e.stopPropagation()
    const firstEnabled = provider.models.find((m) => m.enabled)?.id ?? provider.models[0]?.id ?? ''
    setDefaultProvider(provider.id, firstEnabled)
  }, [provider, setDefaultProvider])

  const handleAddModel = useCallback(() => {
    addModel(provider.id, { id: `new-model-${Date.now()}`, name: 'New Model', enabled: true })
    setExpanded(true); setViewMode('list')
  }, [provider.id, addModel])

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`, backgroundColor: 'var(--bg-secondary, #111827)' }}>
      {/* Header — top row: expand + toggle + icon + name + badges */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 8px', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="9 6 15 12 9 18" />
        </svg>
        <div onClick={(e) => e.stopPropagation()}>
          <MiniToggle value={provider.enabled} onChange={() => toggleProvider(provider.id)} accent={accent} />
        </div>
        {BrandIc && (
          <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <BrandIc size={22} />
          </div>
        )}
        <span style={{ fontSize: 14, fontWeight: 600, color: provider.enabled ? C.textPrimary : C.textMuted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{provider.name}</span>
        <span style={{ fontSize: 10, color: C.textMuted, flexShrink: 0, padding: '2px 8px', borderRadius: 9999, border: `1px solid ${C.inputBorder}` }}>
          {provider.models.length} model{provider.models.length !== 1 ? 's' : ''}
        </span>
        {isDefault && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent, fontWeight: 500, flexShrink: 0 }}>Default</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button" title={isDefault ? 'Default provider' : 'Set as default'} onClick={handleSetDefault}
            style={{ padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: isDefault ? accent : C.textMuted, opacity: isDefault ? 1 : 0.35 }}
          >
            <RadioIcon selected={isDefault} size={14} color={isDefault ? accent : undefined} />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); setDelTarget({ type: 'provider' }) }} style={{ padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: C.textError, opacity: 0.45 }} title="Delete provider">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Header — bottom row: id badge + URL edit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 10px', paddingLeft: 59 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: accent, backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)`, padding: '2px 7px', borderRadius: 5, flexShrink: 0 }}>{provider.id}</span>
        <input
          type="text" value={provider.baseUrl}
          onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="https://api.example.com/v1"
          style={{ flex: 1, height: 28, borderRadius: 6, border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.textMuted, padding: '0 8px', fontSize: 11, outline: 'none', fontFamily: 'monospace' }}
        />
      </div>

      {/* Model pills (collapsed) */}
      {!expanded && provider.models.some((m) => m.enabled) && (
        <div style={{ padding: '0 14px 10px', paddingLeft: 59 }}>
          <ModelPills
            models={provider.models.filter((m) => m.enabled)}
            accent={accent}
            selectedModelId={isDefault ? defaultModelId : undefined}
            onPillClick={(modelId) => setDefaultProvider(provider.id, modelId)}
          />
        </div>
      )}

      {/* API key */}
      {!NO_KEY_PROVIDERS.has(provider.id) && (
        <div style={{ padding: '0 14px 10px', paddingLeft: 59 }}>
          <ApiKeyManager providerId={provider.id} />
        </div>
      )}

      {/* Expanded model list */}
      {expanded && (
        <div style={{ borderTop: `1px solid color-mix(in srgb, ${accent} 15%, transparent)`, background: 'var(--bg-primary, #0b1020)', padding: '8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 14 }} />
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, color: accent, opacity: 0.7 }}>Models</span>
            <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
              {['pills', 'list'].map((m) => (
                <button key={m} type="button" onClick={() => setViewMode(m)} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer', color: viewMode === m ? 'white' : C.textMuted, backgroundColor: viewMode === m ? accent : 'transparent' }}>
                  {m === 'pills' ? '● Badges' : '≡ List'}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleAddModel} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, border: 'none', background: 'transparent', color: accent, cursor: 'pointer', padding: '2px 8px', borderRadius: 6 }}>
              <span>+</span><span>Add</span>
            </button>
          </div>

          {provider.models.length === 0 ? (
            <p style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic', margin: '8px 0 8px 14px' }}>No models configured.</p>
          ) : viewMode === 'pills' ? (
            <div style={{ paddingLeft: 14, paddingBottom: 8 }}>
              <ModelPills
                models={provider.models.filter((m) => m.enabled)}
                accent={accent}
                selectedModelId={isDefault ? defaultModelId : undefined}
                onPillClick={(modelId) => setDefaultProvider(provider.id, modelId)}
              />
            </div>
          ) : (
            provider.models.map((m) => (
              <ModelRow
                key={m.id}
                model={m}
                providerId={provider.id}
                onDelete={() => setDelTarget({ type: 'model', modelId: m.id })}
                isSelected={isDefault && m.id === defaultModelId}
                onSelect={() => setDefaultProvider(provider.id, m.id)}
                accent={accent}
              />
            ))
          )}
        </div>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.inputBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textError} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2L14.5 13H1.5Z" /><line x1="8" y1="6" x2="8" y2="9" /><circle cx="8" cy="11.5" r=".5" fill={C.textError} />
          </svg>
          <span style={{ fontSize: 11, color: C.textMuted, flex: 1 }}>
            {delTarget.type === 'provider' ? `Delete "${provider.name}" and all its models?` : 'Delete this model?'}
          </span>
          <button type="button" onClick={() => {
            if (delTarget.type === 'provider') removeProvider(provider.id)
            else if (delTarget.modelId) removeModel(provider.id, delTarget.modelId)
            setDelTarget(null)
          }} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' }}>Delete</button>
          <button type="button" onClick={() => setDelTarget(null)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: C.textMuted, cursor: 'pointer' }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

/* ── Copilot Provider Card ────────────────────────────────── */

const COPILOT_ACCENT = BRAND.copilot

function CopilotProviderCard({ provider }) {
  const { providers, addProvider, toggleProvider, setDefaultProvider } = useAiProvidersStore()
  const defaultProviderId = useAiProvidersStore((s) => s.defaultProviderId)
  const defaultModelId    = useAiProvidersStore((s) => s.defaultModelId)
  const [liveModels,    setLiveModels]    = useState([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [expanded,      setExpanded]      = useState(true)
  const isDefault = defaultProviderId === 'copilot'

  const handleToggle = useCallback(() => {
    const inStore = providers.find((p) => p.id === 'copilot')
    if (inStore) toggleProvider('copilot')
    else addProvider({ ...provider, enabled: false })
  }, [providers, provider, addProvider, toggleProvider])

  // Fetch live Copilot models from /ck8t/llm/providers
  useEffect(() => {
    if (liveModels.length > 0 || loadingModels) return
    setLoadingModels(true)
    fetchAvailableProviders()
      .then((data) => {
        const models = data?.copilot?.models ?? []
        if (models.length > 0) setLiveModels(models.filter((m) => m.id !== 'auto'))
      })
      .catch(() => {})
      .finally(() => setLoadingModels(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const displayModels = useMemo(() => {
    const autoEntry = { id: 'auto', name: 'Auto (Copilot chooses)', enabled: true }
    const rest = liveModels.length > 0
      ? liveModels.map((m) => ({ id: m.id, name: m.label || m.name || m.id, enabled: true }))
      : provider.models.filter((m) => m.id !== 'auto').map((m) => ({ ...m, enabled: true }))
    return [autoEntry, ...rest]
  }, [liveModels, provider.models])

  const handleSetDefault = useCallback((e) => {
    e.stopPropagation()
    const defModel = provider.models.find((m) => m.enabled)?.id ?? 'auto'
    setDefaultProvider('copilot', defModel)
  }, [provider.models, setDefaultProvider])

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: `2px solid color-mix(in srgb, ${COPILOT_ACCENT} 35%, transparent)`, backgroundColor: 'var(--bg-secondary, #111827)' }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 6px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={COPILOT_ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="9 6 15 12 9 18" />
        </svg>
        <div onClick={(e) => e.stopPropagation()}>
          <MiniToggle value={provider.enabled} onChange={handleToggle} accent={COPILOT_ACCENT} />
        </div>
        <CopilotIcon size={22} />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1, color: COPILOT_ACCENT }}>GitHub Copilot</span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, fontWeight: 500, backgroundColor: `color-mix(in srgb, ${COPILOT_ACCENT} 12%, transparent)`, color: COPILOT_ACCENT, flexShrink: 0 }}>No API key</span>
        {isDefault && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, backgroundColor: `color-mix(in srgb, ${COPILOT_ACCENT} 14%, transparent)`, color: COPILOT_ACCENT, fontWeight: 500, flexShrink: 0 }}>Default</span>}
        <div onClick={(e) => e.stopPropagation()}>
          <button type="button" title={isDefault ? 'Default provider' : 'Set as default'} onClick={handleSetDefault} style={{ padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: isDefault ? COPILOT_ACCENT : C.textMuted, opacity: isDefault ? 1 : 0.3 }}>
            <RadioIcon selected={isDefault} size={14} color={isDefault ? COPILOT_ACCENT : undefined} />
          </button>
        </div>
      </div>
      {/* Sub-row: description */}
      <div style={{ padding: '0 14px 10px', paddingLeft: 57, fontSize: 11, color: C.textMuted }}>
        Uses your active GitHub Copilot subscription via VS Code Language Model API.
      </div>
      {!expanded && displayModels.some((m) => m.enabled) && (
        <div style={{ padding: '0 14px 10px', paddingLeft: 57 }}>
          <ModelPills
            models={displayModels.filter((m) => m.enabled)}
            accent={COPILOT_ACCENT}
            selectedModelId={isDefault ? defaultModelId : undefined}
            onPillClick={(modelId) => setDefaultProvider('copilot', modelId)}
          />
        </div>
      )}
      {expanded && (
        <div style={{ borderTop: `1px solid color-mix(in srgb, ${COPILOT_ACCENT} 18%, transparent)`, background: 'var(--bg-primary, #0b1020)', padding: '10px 14px 12px', paddingLeft: 57 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, color: COPILOT_ACCENT, opacity: 0.8 }}>
            {loadingModels ? 'Loading models from VS Code…' : 'Available Models — click to set default'}
          </p>
          <ModelPills
            models={displayModels}
            accent={COPILOT_ACCENT}
            selectedModelId={isDefault ? defaultModelId : undefined}
            onPillClick={(modelId) => setDefaultProvider('copilot', modelId)}
          />
        </div>
      )}
    </div>
  )
}

/* ── Custom Provider Quick-Add Form ──────────────────────── */

function CustomProviderForm({ show, onClose, onAdd }) {
  const [name,      setName]      = useState('')
  const [baseUrl,   setBaseUrl]   = useState('')
  const [modelId,   setModelId]   = useState('')
  const [modelName, setModelName] = useState('')

  const handleAdd = () => {
    if (!name.trim() || !baseUrl.trim()) return
    const id = `custom-${Date.now()}`
    const models = modelId.trim() ? [{ id: modelId.trim(), name: modelName.trim() || modelId.trim(), enabled: true }] : []
    onAdd({ id, name: name.trim(), baseUrl: baseUrl.trim(), enabled: true, models })
    setName(''); setBaseUrl(''); setModelId(''); setModelName('')
    onClose()
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onClose() }
  const canAdd = name.trim() && baseUrl.trim()

  if (!show) return null

  return (
    <div style={{
      borderRadius: 10, border: `1px solid color-mix(in srgb, ${C.ai} 30%, transparent)`,
      background: 'var(--bg-secondary, #111827)', padding: '20px 20px 16px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, margin: 0 }}>Add Custom Provider</p>
          <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>Any OpenAI-compatible API endpoint</p>
        </div>
        <button type="button" onClick={onClose} style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: C.textMuted, borderRadius: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Provider Name</label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="e.g. My LLaMA" autoFocus
            style={{ height: 34, borderRadius: 7, border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.textPrimary, padding: '0 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Base URL</label>
          <input
            type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="http://localhost:11434/v1"
            style={{ height: 34, borderRadius: 7, border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.textPrimary, padding: '0 10px', fontSize: 12, outline: 'none', fontFamily: 'monospace' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Model Name <span style={{ fontStyle: 'italic', textTransform: 'none' }}>(optional)</span></label>
          <input
            type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="e.g. LLaMA 3.2"
            style={{ height: 34, borderRadius: 7, border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.textPrimary, padding: '0 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Model ID <span style={{ fontStyle: 'italic', textTransform: 'none' }}>(optional)</span></label>
          <input
            type="text" value={modelId} onChange={(e) => setModelId(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="e.g. llama3.2"
            style={{ height: 34, borderRadius: 7, border: `1px solid ${C.inputBorder}`, background: C.inputBg, color: C.textPrimary, padding: '0 10px', fontSize: 12, outline: 'none', fontFamily: 'monospace' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
        <button
          type="button" onClick={handleAdd} disabled={!canAdd}
          style={{ padding: '8px 18px', fontSize: 12, fontWeight: 500, borderRadius: 7, border: 'none', cursor: canAdd ? 'pointer' : 'not-allowed', background: canAdd ? C.ai : 'rgba(99,102,241,0.3)', color: 'white', transition: 'background 0.15s' }}
        >
          Add Provider
        </button>
        <button
          type="button" onClick={onClose}
          style={{ padding: '8px 14px', fontSize: 12, borderRadius: 7, border: `1px solid ${C.inputBorder}`, cursor: 'pointer', background: 'transparent', color: C.textMuted }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/* ── Main AI Providers Panel ──────────────────────────────── */

const _copilotDef = AI_PROVIDERS.find((p) => p.id === 'copilot')

const COPILOT_DEFAULT = {
  id: 'copilot', name: 'GitHub Copilot', baseUrl: _copilotDef?.baseUrl ?? 'vscode://copilot', enabled: true,
  models: (_copilotDef?.models ?? []).map((m) => ({ id: m.id, name: m.name, enabled: true })), hasKey: false,
}

export default function AiProvidersPanel() {
  const { providers, loaded, load, loadKeys, addProvider, seedDefaults } = useAiProvidersStore()
  const [resetConfirm,   setResetConfirm]   = useState(false)
  const [showAddForm,    setShowAddForm]    = useState(false)

  useEffect(() => { load() }, [load])
  useEffect(() => { loadKeys() }, [loadKeys])

  const copilot = useMemo(() => providers.find((p) => p.id === 'copilot') ?? COPILOT_DEFAULT, [providers])
  const others  = useMemo(() => providers.filter((p) => p.id !== 'copilot' && p.id !== 'daakia-mock'), [providers])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.10)', paddingTop: 12 }}>
        <div style={{ display: 'flex', padding: '0 20px' }}>
          <span style={{ padding: '8px 12px', fontSize: 12, borderBottom: `2px solid ${C.ai}`, fontWeight: 500, color: C.ai }}>
            Providers &amp; Models
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, margin: 0 }}>AI Providers</p>
              <p style={{ fontSize: 11, color: C.textMuted, marginTop: 3, marginBottom: 0 }}>
                Toggle providers, add API keys, set a default, or add custom OpenAI-compatible endpoints.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, paddingTop: 2 }}>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 11, fontWeight: 500, borderRadius: 7, cursor: 'pointer', border: `1px solid color-mix(in srgb, ${C.ai} 40%, transparent)`, color: showAddForm ? 'white' : C.ai, background: showAddForm ? C.ai : `color-mix(in srgb, ${C.ai} 8%, transparent)`, transition: 'all 0.15s' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                <span>Add Custom</span>
              </button>
              <button
                type="button"
                onClick={() => setResetConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 11, borderRadius: 7, cursor: 'pointer', border: `1px solid ${C.inputBorder}`, color: C.textMuted, background: 'transparent' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" /></svg>
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Custom provider form — full-width below toolbar */}
          <CustomProviderForm show={showAddForm} onClose={() => setShowAddForm(false)} onAdd={(p) => { addProvider(p); setShowAddForm(false) }} />

          {/* Provider list */}
          {!loaded ? (
            <p style={{ fontSize: 12, color: C.textMuted, padding: '16px 0' }}>Loading providers…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CopilotProviderCard provider={copilot} />
              {others.map((p) => <ProviderCard key={p.id} provider={p} />)}
              {others.length === 0 && (
                <p style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic', padding: '8px 0' }}>
                  No other providers configured. Add API keys above or add a custom provider.
                </p>
              )}
            </div>
          )}

          {/* Info box */}
          <div style={{ padding: 12, borderRadius: 6, border: '1px solid rgba(139,92,246,0.15)', backgroundColor: 'rgba(139,92,246,0.06)' }}>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: C.ai }}>API Keys</p>
            <ul style={{ fontSize: 11, color: C.textMuted, margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>• Keys are stored securely in VS Code SecretStorage (OS keychain)</li>
              <li>• Keys are automatically injected into requests — no need to paste each time</li>
              <li>• GitHub Copilot: no API key needed — uses your active Copilot subscription</li>
              <li>• For Ollama: no API key needed, just set the base URL</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Reset confirm */}
      {resetConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: 20, maxWidth: 360, width: '90%' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>Reset to Defaults</p>
            <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>This will replace all provider and model settings with the built-in defaults. Custom providers will be lost.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setResetConfirm(false)} style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.08)', color: C.textMuted, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={() => { seedDefaults(); setResetConfirm(false) }} style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' }}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
