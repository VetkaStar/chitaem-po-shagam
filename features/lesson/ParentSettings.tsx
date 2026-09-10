'use client';
import AutoAdvanceSettings from '@/components/auto-advance-settings';
import VisionSettings from './VisionSettings';
import { visionStyle } from '@/lib/vision';
import { Mic, MicOff, ArrowRight, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { levels } from '@/lib/learning';
import type { LessonModel } from './use-lesson';
export default function ParentSettings({
  model,
}: {
  model: Pick<
    LessonModel,
    | 'parent'
    | 'stop'
    | 'setParent'
    | 'settings'
    | 'update'
    | 'micDevices'
    | 'testMic'
    | 'micTesting'
    | 'micLevel'
    | 'micMessage'
    | 'stars'
    | 'history'
    | 'exportReport'
    | 'storageWarning'
    | 'target'
  >;
}) {
  const {
    parent,
    stop,
    setParent,
    settings,
    update,
    micDevices,
    testMic,
    micTesting,
    micLevel,
    micMessage,
    stars,
    history,
    exportReport,
    storageWarning,
    target,
  } = model;
  return (
    <>
      <Dialog
        open={parent}
        onOpenChange={(v) => {
          stop();
          setParent(v);
        }}
      >
        <DialogContent
          className="parent-dialog"
          data-vision={settings.colorVision}
          style={visionStyle(settings.colorVision)}
        >
          <DialogTitle className="dialog-heading">Настроим занятие</DialogTitle>
          <DialogDescription>
            Настройки и результаты сохраняются только в этом браузере на этом
            устройстве.
          </DialogDescription>
          <AutoAdvanceSettings model={model} />
          <div className="setting">
            <label>Материал</label>
            <Select
              value={String(settings.unit)}
              onValueChange={(v) => {
                if (v !== null) update('unit', Number(v));
              }}
            >
              <SelectTrigger aria-label="Материал занятия">
                <SelectValue>{levels[settings.unit].name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {levels.map((l, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="setting">
            <label>Длина занятия</label>
            <Select
              value={String(settings.length)}
              onValueChange={(v) => {
                if (v !== null) update('length', Number(v));
              }}
            >
              <SelectTrigger aria-label="Количество заданий">
                <SelectValue>{settings.length} заданий</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 8].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} заданий
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="setting">
            <label>
              <b>Как часто предлагать отдых</b>
              <small>
                Можно выбрать задания или минуты. По времени — после текущего
                задания. Отдых и главное меню не считаются.
              </small>
            </label>
            <select
              aria-label="Частота разминок"
              value={
                settings.breakMinutes
                  ? 'm' + settings.breakMinutes
                  : 't' + settings.breakEvery
              }
              onChange={(e) => {
                const v = e.target.value;
                update('breakMinutes', v[0] === 'm' ? Number(v.slice(1)) : 0);
                update('breakEvery', v[0] === 't' ? Number(v.slice(1)) : 0);
              }}
            >
              <option value="t0">Только по кнопке</option>
              {[3, 5, 8, 10].map((n) => (
                <option key={'t' + n} value={'t' + n}>
                  Через {n} заданий
                </option>
              ))}
              {[3, 5, 10, 15].map((n) => (
                <option key={'m' + n} value={'m' + n}>
                  Через {n} минут занятия
                </option>
              ))}
            </select>
          </div>
          <VisionSettings
            value={settings.colorVision}
            onChange={(v) => update('colorVision', v)}
          />
          {(
            [
              [
                'motion',
                'Анимации и эффекты',
                'Плавное движение и звёздочка за успех. Можно отключить.',
              ],
              [
                'sound',
                'Озвучка и музыка',
                'Подсказки при чтении. Музыка в паузе — только по кнопке.',
              ],
              [
                'slow',
                'Медленная озвучка',
                'Больше времени, чтобы расслышать.',
              ],
              [
                'color',
                'Цветные буквы',
                settings.colorVision === 'off'
                  ? 'Гласные — терракотовые, согласные — зелёные.'
                  : 'Гласные — двойная линия, согласные — одна линия.',
              ],
            ] as const
          ).map(([k, title, sub]) => (
            <div className="setting" key={k}>
              <label htmlFor={'setting-' + k}>
                <b>{title}</b>
                <small>{sub}</small>
              </label>
              <Switch
                id={'setting-' + k}
                checked={settings[k]}
                onCheckedChange={(v) => update(k, v)}
              />
            </div>
          ))}
          <div className="setting">
            <label htmlFor="speech-mode">
              <b>Озвучка подсказок и ответов</b>
              <small>
                По кнопке с динамиком или сразу после ответа ребёнка.
              </small>
            </label>
            <Select
              value={settings.autoSpeech ? 'auto' : 'button'}
              onValueChange={(v) => {
                if (v !== null) {
                  stop();
                  update('autoSpeech', v === 'auto');
                }
              }}
            >
              <SelectTrigger
                id="speech-mode"
                aria-label="Режим озвучки"
                disabled={!settings.sound}
              >
                <SelectValue>
                  {settings.autoSpeech ? 'Автоматически' : 'По кнопке'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="button">По кнопке</SelectItem>
                <SelectItem value="auto">Автоматически</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mic-settings">
            <h3>Микрофон</h3>
            <Select
              value={settings.micDevice || 'default-device'}
              onValueChange={(v) => {
                stop();
                update('micDevice', v === 'default-device' ? '' : String(v));
              }}
            >
              <SelectTrigger aria-label="Устройство микрофона">
                <SelectValue>
                  {micDevices.find((d) => d.deviceId === settings.micDevice)
                    ?.label || 'Микрофон по умолчанию'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default-device">
                  Микрофон по умолчанию
                </SelectItem>
                {micDevices
                  .filter((d) => d.deviceId && d.deviceId !== 'default')
                  .map((d, i) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label || `Микрофон ${i + 1}`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <button onClick={testMic}>
              {micTesting ? <MicOff size={16} /> : <Mic size={16} />}{' '}
              {micTesting ? 'Остановить проверку' : 'Проверить микрофон'}
            </button>
            <meter
              min={0}
              max={1}
              value={micLevel}
              aria-label="Проверка громкости микрофона"
            />
            <p>{micMessage}</p>
          </div>
          <div className="parent-info">
            <h3>Как заниматься</h3>
            <p>
              Буквы, слоги и слова следуют выбранной теме. Слова состоят из уже
              доступных букв; новые появляются по мере смены темы. В новом
              занятии порядок перемешивается, одинаковые карточки не идут
              подряд. В паузе можно выбрать игру или движение.
            </p>
            <p>
              Начните с 3–5 заданий. Один экран — одно действие. Можно отвечать
              голосом, с клавиатуры или вместе со взрослым. Остановитесь раньше,
              если ребёнок устал. Следующий шаг можно выбрать вместе; все
              разделы доступны.
            </p>
            <p>
              На кнопке «Послушать название» звучит название буквы. Для слияния
              в слог взрослый показывает именно звук: «м», а не «эм». Образец
              слога произносится целиком.
            </p>
            <h3>О микрофоне</h3>
            <p>
              Автораспознавание — подсказка, а не оценка произношения. Детская
              речь и отдельные слоги могут распознаваться неверно. Уверенно
              распознанный другой учебный слог подсвечивается мягким красным и
              сравнивается с заданием. Если распознавание не уверено —
              оранжевый, без счёта ошибок. Посторонняя речь не выводится. После
              двух ошибок появляется образец, после трёх — дополнительная
              помощь. Ручная оценка доступна в каждом задании.
            </p>
            <p>
              Речь распознаётся прямо на устройстве с помощью Vosk. При первом
              запуске загружается русская модель (около 45 МБ). Голос не
              отправляется на сервер и не сохраняется. Для загрузки нужен
              интернет; для чтения — разрешение микрофона. Индикатор показывает
              реальный уровень звука. В настройках можно выбрать другое
              устройство.
            </p>
            {settings.micConsent && (
              <button
                className="text-button"
                onClick={() => update('micConsent', false)}
              >
                Выключить согласие на распознавание
              </button>
            )}
            <h3>Прогресс</h3>
            <p>
              {stars} звёзд · записей в журнале: {history.length}. Пропуски и
              просьбы о помощи сохраняются отдельно от верных ответов. Последние
              300 записей.
            </p>
            <button onClick={exportReport} disabled={!history.length}>
              <Download size={17} /> Скачать результаты
            </button>
            {storageWarning && <p className="warning">{storageWarning}</p>}
            <details className="sources">
              <summary>Учебник и источники</summary>
              <p>
                Аксёнова А. К., Комарова С. В., Шишкова М. И. «Букварь», часть
                1. Проверены страницы 40–53, а также 54, 58, 61 и 62: М →
                обратные слоги → прямые слоги → О → Х → С → Н → Ы → Л.
                Последующие наборы и игры — авторское дополнение, не полный
                цифровой учебник. Иллюстрации книги не переиздаются.
              </p>
              <a
                href="http://i.internat5vlg.ru/u/ea/abe0f684c111ea83f3b5f3c7fe5d55/-/Букварь%201%20класс%20часть%201%20АОП%20%28Аксенова%29.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Найденный PDF учебника ↗
              </a>
              <a
                href="https://www.cdc.gov/adhd/treatment/classroom.html"
                target="_blank"
                rel="noreferrer"
              >
                CDC: короткие задания, обратная связь и перерывы ↗
              </a>
              <a
                href="https://www.autism.org.uk/advice-and-guidance/education/getting-help-at-school/what-can-my-autistic-child-get-support-with-at-school"
                target="_blank"
                rel="noreferrer"
              >
                National Autistic Society: понятные шаги и спокойная среда ↗
              </a>
              <p>
                Это учебный тренажёр, не медицинская программа. Темп и подход
                подбираются под конкретного ребёнка.
              </p>
            </details>
          </div>
          <button
            className="primary"
            onClick={() => {
              stop();
              setParent(false);
            }}
          >
            Вернуться к занятию <ArrowRight size={18} />
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
