import { Entry } from './config';

/** Extracted action: state remains owned by useLesson. */
export function createReportExporter(context: { history: Entry[] }) {
  const { history } = context;
  return function exportReport() {
    const text = [
      'Читаем по шагам — результаты на этом устройстве',
      'Дата;Материал;Раздел;Режим;Результат;Проверка',
      ...history.map((h) =>
        [h.at, h.target, h.stage, h.mode, h.result, h.via].join(';'),
      ),
    ].join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reading-progress.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}
