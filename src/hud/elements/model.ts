/**
 * OMC HUD - Model Element
 *
 * Renders the current model name.
 */

import { dim, getModelTierColor, RESET } from '../colors.js';
import { truncateToWidth } from '../../utils/string-width.js';
import { DEFAULT_HUD_LABELS, type HudLabels, type ModelFormat } from '../types.js';

/**
 * Extract version from a model ID string.
 * E.g., 'claude-opus-4-8-20260528' -> '4.8'
 *       'claude-sonnet-4-6-20260217' -> '4.6'
 *       'claude-haiku-4-5-20251001' -> '4.5'
 *       'claude-3-5-sonnet-20241022' -> '3.5'
 *       'claude-3-opus-20240229' -> '3'
 *       'claude-sonnet-5' -> '5'
 */
function extractVersion(modelId: string): string | null {
  // Match hyphenated ID patterns like opus-4-6, sonnet-4-5, haiku-4-5
  const idMatch = modelId.match(/(?:opus|sonnet|haiku)-(\d+)-(\d+)/i);
  if (idMatch) return `${idMatch[1]}.${idMatch[2]}`;

  // Match Claude family IDs with a single trailing numeric version like claude-sonnet-5
  const singleSegmentIdMatch = modelId.match(/(?:^|[.-])claude-(?:opus|sonnet|haiku)-(\d+)$/i);
  if (singleSegmentIdMatch) return singleSegmentIdMatch[1];

  // Match legacy raw ID patterns like claude-3-5-sonnet-20241022 and claude-3-opus-20240229
  const legacyIdMatch = modelId.match(/claude-(\d+)(?:-(\d+))?-(?:opus|sonnet|haiku)/i);
  if (legacyIdMatch) {
    return legacyIdMatch[2] ? `${legacyIdMatch[1]}.${legacyIdMatch[2]}` : legacyIdMatch[1];
  }

  // Match display name patterns like "Sonnet 4.5", "Opus 4.8"
  const displayMatch = modelId.match(/(?:opus|sonnet|haiku)\s+(\d+(?:\.\d+)?)/i);
  if (displayMatch) return displayMatch[1];

  return null;
}

/**
 * 常见非 Claude 模型 → 友好家族名映射（按前缀/关键字匹配）。
 * 这些模型在 HUD 中同样应显示为可读名称而非原始 ID（配合 colors.ts 的档位色）。
 */
const EXTERNAL_MODEL_FAMILIES: Array<{ re: RegExp; name: string }> = [
  { re: /deepseek/i, name: 'DeepSeek' },
  { re: /(^|[^a-z])gpt/i, name: 'GPT' },
  { re: /(^|[^a-z])o[1-9]-/i, name: 'OpenAI' },
  { re: /qwen/i, name: 'Qwen' },
  { re: /gemini/i, name: 'Gemini' },
  { re: /llama/i, name: 'Llama' },
  { re: /mistral/i, name: 'Mistral' },
  { re: /glm/i, name: 'GLM' },
  { re: /kimi|moonshot/i, name: 'Kimi' },
  { re: /ernie/i, name: 'ERNIE' },
  { re: /doubao/i, name: 'Doubao' },
  { re: /hunyuan/i, name: 'Hunyuan' },
];

/**
 * 从外部模型 ID 提取版本/变体（如 deepseek-v4-flash → "V4"，gpt-4o → "4o"，gemini-2.5-pro → "2.5 Pro"，qwen-max → "Max"）。
 * - 版本号优先：v<N> → "VN"（大写），-<N>(.<N>)?(字母)? → 原样（4o/3.5）
 * - 版本后仅追加 pro/max/ultra/turbo 等"能力档"变体（flash/lite 不追加，保持简洁）
 * - 无版本号时使用变体名（qwen-max → "Max"）
 */
function extractExternalVariant(id: string): string | null {
  const vMatch = id.match(/(?:^|[-_])v?(\d+(?:\.\d+)?[a-z]?)/i);
  if (vMatch) {
    const raw = vMatch[1];
    // vMatch[0] 含前导分隔符与可选 v 前缀（如 "-v4" / "-4o" / "-2.5"）
    const version = /(^|[-_])v/i.test(vMatch[0]) ? `V${raw}` : raw;
    const after = id.slice(vMatch.index! + vMatch[0].length);
    const tail = after.match(/^[-_](pro|max|ultra|turbo)\b/i);
    if (tail) {
      const t = tail[1].charAt(0).toUpperCase() + tail[1].slice(1);
      return `${version} ${t}`;
    }
    return version;
  }
  const variantMatch = id.match(/(?:^|[-_])(flash|lite|pro|max|turbo|mini|ultra|nano)\b/i);
  if (variantMatch) {
    const v = variantMatch[1];
    return v.charAt(0).toUpperCase() + v.slice(1);
  }
  return null;
}

/**
 * Format model name for display.
 * Converts model IDs to friendly names based on the requested format.
 * 支持 Claude 三档 + 常见外部模型家族（DeepSeek/GPT/Qwen/Gemini 等）。
 */
export function formatModelName(modelId: string | null | undefined, format: ModelFormat = 'short'): string | null {
  if (!modelId) return null;

  if (format === 'full') {
    return truncateToWidth(modelId, 40);
  }

  const id = modelId.toLowerCase();
  let shortName: string | null = null;

  if (id.includes('opus')) shortName = 'Opus';
  else if (id.includes('sonnet')) shortName = 'Sonnet';
  else if (id.includes('haiku')) shortName = 'Haiku';
  else {
    // 非 Claude 模型：匹配外部家族
    for (const fam of EXTERNAL_MODEL_FAMILIES) {
      if (fam.re.test(id)) {
        shortName = fam.name;
        break;
      }
    }
  }

  if (!shortName) {
    // Return original if not recognized (CJK-aware truncation)
    return truncateToWidth(modelId, 20);
  }

  if (format === 'versioned') {
    if (shortName === 'Opus' || shortName === 'Sonnet' || shortName === 'Haiku') {
      const version = extractVersion(id);
      if (version) return `${shortName} ${version}`;
    } else {
      // 外部模型：提取版本/变体（如 DeepSeek V4、GPT 4o、Gemini Pro）
      const variant = extractExternalVariant(id);
      if (variant) return `${shortName} ${variant}`;
    }
  }

  return shortName;
}

/**
 * Render model element.
 * 标签语法统一（P0-2）：dim(Model:) + 档位色值（tier.*，与状态色不相交 — P0-1）。
 * 旧实现整段 cyan，废弃。
 */
export function renderModel(
  modelId: string | null | undefined,
  format: ModelFormat = 'versioned',
  labels: Pick<HudLabels, 'model'> = DEFAULT_HUD_LABELS,
): string | null {
  const name = formatModelName(modelId, format);
  if (!name) return null;
  const tierColor = getModelTierColor(modelId ?? undefined);
  return `${dim(`${labels.model}: `)}${tierColor}${name}${RESET}`;
}
