/**
 * OMC HUD - Skills Element
 *
 * Renders active skills badge (ultrawork, ralph mode indicators).
 */
import { RESET, APPLE_PURPLE, APPLE_CYAN } from '../colors.js';
import { truncateToWidth } from '../../utils/string-width.js';
/**
 * Truncate string to max visual width with ellipsis.
 * CJK-aware: accounts for double-width characters.
 */
function truncate(str, maxWidth) {
    return truncateToWidth(str, maxWidth);
}
/**
 * Extract the display name from a skill name.
 * For namespaced skills (e.g., "oh-my-claudecode:plan"), returns only the last segment ("plan").
 * For non-namespaced skills, returns the name unchanged.
 */
function getSkillDisplayName(skillName) {
    return skillName.split(':').pop() || skillName;
}
/**
 * Check if a skill name corresponds to an active mode.
 */
function isActiveMode(skillName, ultrawork, ralph) {
    if (skillName === 'ultrawork' && ultrawork?.active)
        return true;
    if (skillName === 'ralph' && ralph?.active)
        return true;
    if (skillName === 'ultrawork+ralph' && ultrawork?.active && ralph?.active)
        return true;
    return false;
}
/**
 * Render active skill badges with optional last skill.
 * Returns null if no skills are active.
 *
 * Format: ultrawork or ultrawork + ralph | skill:planner
 */
export function renderSkills(ultrawork, ralph, lastSkill) {
    const parts = [];
    // Active modes (ultrawork, ralph)
    if (ralph?.active && ultrawork?.active) {
        // Combined mode
        parts.push(`${APPLE_PURPLE}ultrawork+ralph${RESET}`);
    }
    else if (ultrawork?.active) {
        parts.push(`${APPLE_PURPLE}ultrawork${RESET}`);
    }
    else if (ralph?.active) {
        parts.push(`${APPLE_PURPLE}ralph${RESET}`);
    }
    // Last skill (if different from active mode)
    if (lastSkill && !isActiveMode(lastSkill.name, ultrawork, ralph)) {
        const displayName = getSkillDisplayName(lastSkill.name);
        const argsPart = lastSkill.args ? `(${lastSkill.args})` : '';
        parts.push(`${APPLE_CYAN}skill:${displayName}${argsPart}${RESET}`);
    }
    return parts.length > 0 ? parts.join(' ') : null;
}
/**
 * Render last skill standalone (when activeSkills is disabled but lastSkill is enabled).
 */
export function renderLastSkill(lastSkill) {
    if (!lastSkill)
        return null;
    const displayName = getSkillDisplayName(lastSkill.name);
    const argsPart = lastSkill.args ? `(${lastSkill.args})` : '';
    return `${APPLE_CYAN}skill:${displayName}${argsPart}${RESET}`;
}
/**
 * Render skill with reinforcement count (for debugging).
 *
 * Format: ultrawork(r3)
 */
export function renderSkillsWithReinforcement(ultrawork, ralph) {
    if (!ultrawork?.active && !ralph?.active) {
        return null;
    }
    const parts = [];
    if (ultrawork?.active) {
        const reinforcement = ultrawork.reinforcementCount > 0 ? `(r${ultrawork.reinforcementCount})` : '';
        parts.push(`ultrawork${reinforcement}`);
    }
    if (ralph?.active) {
        parts.push('ralph');
    }
    return `${APPLE_PURPLE}${parts.join('-')}${RESET}`;
}
//# sourceMappingURL=skills.js.map