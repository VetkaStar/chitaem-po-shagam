import type { Supply } from '../../lib/curriculum/types.js';
export const readingLabels: Record<string, string> = {
  letters: 'буквы',
  syllables: 'слоги',
  short_words: 'короткие слова',
  multi_part: 'длинные слова',
  sentences: 'предложения',
  texts: 'тексты',
};
export const placementNotes: Record<string, string> = {
  formal_route:
    'Подготовительные условия проверены. Можно начать программу с указанного ниже шага.',
  resume_course:
    'В программе уже есть незавершённое задание. Вернёмся к нему, сохранив прежнюю позицию.',
  engine_gate:
    'Перед началом программы нужна дополнительная подготовка или поддержка. Формальный старт пока не назначен.',
  engine_action:
    'В программе уже запланировано следующее действие. При продолжении приложение заново проверит сохранённую позицию; новый учебный эпизод здесь не назначается.',
  provisional_free:
    'Пока предлагаем свободную практику. Она не продвигает программу и не подтверждает навык автоматически.',
  entry_checkpoint_needed:
    'Для рекомендованной цели нужно отдельно проверить подготовительный навык. До этого старт программы не назначен.',
  entry_checkpoint_unavailable:
    'Сейчас нет подходящего задания для нужной входной проверки. Это ограничение материала, а не ошибка ребёнка. Старт программы не назначен.',
  scope_complete:
    'Доступный диапазон входных проверок пройден. Это не означает, что весь курс завершён или все навыки освоены.',
  side_support:
    'Предлагается отдельная поддержка с последующим возвращением к основной цели. Позиция программы от этого не продвигается.',
  access_setup:
    'Сначала нужно подобрать доступный способ видеть инструкцию и отвечать. Навык чтения пока не оценён.',
};
export function skillTitle(supply: Supply, id: string) {
  const skill = supply.curriculum.skills[id];
  return skill &&
    typeof skill === 'object' &&
    'title' in skill &&
    typeof skill.title === 'string'
    ? skill.title
    : 'Проверяемый навык';
}
export function groupTitle(supply: Supply, id: string) {
  const group = supply.registry.groups[id];
  return group ? skillTitle(supply, group.skillId) : 'Входная проверка';
}
