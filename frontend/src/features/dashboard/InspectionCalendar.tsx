import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Elevator } from '@/features/elevators/types';
import { formatDate, localToday } from '@/shared/lib/dates';
import { Badge, badgeTone } from '@/shared/ui/Badge';
import { Empty } from '@/shared/ui/Empty';
import { usePrototype } from '@/app/state';

export function InspectionCalendar({
  items,
  month,
  setMonth,
}: {
  items: Elevator[];
  month: string;
  setMonth: (value: string) => void;
}) {
  const s = usePrototype();
  const today = localToday();
  const [day, setDay] = useState('');
  const [flash, setFlash] = useState({ date: '', n: 0 });
  const [months, setMonths] = useState(false);
  const [dir, setDir] = useState<'up' | 'down'>('down');
  const ref = useRef<HTMLDivElement>(null);
  const first = new Date(month + 'T12:00:00');
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const label = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(first);
  const year = month.slice(0, 4);
  const all = [
    ...s.requests
      .filter((r) => r.status === 'Agendado' && items.some((e) => e.id === r.elevator))
      .map((r) => ({
        date: r.scheduled.slice(0, 10),
        elevator: r.elevator,
        title: `${r.scope} agendada às ${r.scheduled.slice(11)}`,
        status: r.status,
      })),
    ...items
      .filter((e) => e.validUntil)
      .map((e) => ({
        date: e.validUntil,
        elevator: e.id,
        title: 'Fim do certificado',
        status: e.status,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const events = all.filter((e) => e.date.startsWith(month.slice(0, 7)));
  const shown = day ? events.filter((e) => e.date === day) : events;

  useEffect(() => {
    // Um clique numa zona sem ação do cartão volta a mostrar o mês inteiro.
    const card = ref.current?.closest('.panel');
    if (!card) return;
    function reset(e: Event) {
      if (!(e.target as Element).closest('button, a, input, select, textarea, label')) setDay('');
    }
    card.addEventListener('click', reset);
    return () => card.removeEventListener('click', reset);
  }, []);

  function move(step: number) {
    const d = new Date(first.getFullYear(), first.getMonth() + (months ? step * 12 : step), 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    setDay('');
    setDir(step > 0 ? 'up' : 'down');
  }

  function open(value: string) {
    setMonth(value);
    setMonths(false);
  }

  return (
    <div className="calendar" ref={ref}>
      <div className="calendar-nav">
        <button
          className="text-button"
          aria-label={months ? 'Ano anterior' : 'Mês anterior'}
          onClick={() => move(-1)}
        >
          ‹
        </button>
        <h3 aria-live="polite">
          {months ? (
            year
          ) : (
            <button
              className="calendar-title"
              aria-label={`${label}, ver os meses de ${year}`}
              onClick={() => setMonths(true)}
            >
              {label[0].toUpperCase() + label.slice(1)}
            </button>
          )}
        </h3>
        <button
          className="text-button"
          aria-label={months ? 'Ano seguinte' : 'Mês seguinte'}
          onClick={() => move(1)}
        >
          ›
        </button>
      </div>
      {months ? (
        <div className="calendar-months">
          {Array.from({ length: 12 }, (_, i) => {
            const value = `${year}-${String(i + 1).padStart(2, '0')}-01`;
            const marks = all.filter((e) => e.date.startsWith(value.slice(0, 7)));
            const name = new Intl.DateTimeFormat('pt-PT', { month: 'long' }).format(
              new Date(value + 'T12:00:00'),
            );

            return (
              <button
                key={value}
                className={today.startsWith(value.slice(0, 7)) ? 'today' : ''}
                aria-pressed={value === month}
                aria-label={`${name} de ${year}${marks.length ? `, ${marks.length} ${marks.length > 1 ? 'eventos' : 'evento'}` : ''}`}
                onClick={() => open(value)}
              >
                {name[0].toUpperCase() + name.slice(1)}
                <span className="calendar-dots" aria-hidden="true">
                  {marks.map((e) => (
                    <i key={e.date + e.elevator + e.title} className={badgeTone(e.status)} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="calendar-grid" key={month} data-lift={dir}>
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
              <span key={d} aria-hidden="true">
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`vazio-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = month.slice(0, 8) + String(i + 1).padStart(2, '0');
              const marks = events.filter((e) => e.date === date);
              // As semanas chegam como andares, de cima para baixo.
              const floor = Math.floor((offset + i) / 7);

              return (
                <button
                  key={date === flash.date ? `${date}-${flash.n}` : date}
                  className={`${date === today ? 'today' : ''} ${date === flash.date ? 'flash' : ''}`}
                  aria-pressed={date === day}
                  aria-label={`${formatDate(date)}${marks.length ? `, ${marks.length} ${marks.length > 1 ? 'eventos' : 'evento'}` : ''}`}
                  onClick={() => setDay(date === day ? '' : date)}
                  style={{ '--floor': floor } as CSSProperties}
                >
                  {i + 1}
                  <span className="calendar-dots" aria-hidden="true">
                    {marks.map((e) => (
                      <i key={e.elevator + e.title} className={badgeTone(e.status)} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <ul className="calendar-events">
            {shown.map((e) => (
              <li key={e.date + e.elevator + e.title}>
                <button
                  className="calendar-event"
                  aria-label={`Mostrar ${formatDate(e.date)} no calendário`}
                  onClick={() => setFlash({ date: e.date, n: flash.n + 1 })}
                >
                  <time>{formatDate(e.date)}</time>
                  <span>
                    <strong>
                      {e.elevator} · {e.title}
                    </strong>
                    <small>{items.find((i) => i.id === e.elevator)?.address}</small>
                  </span>
                </button>
                <Badge>{e.status}</Badge>
              </li>
            ))}
            {!shown.length && (
              <li className="calendar-empty">
                <Empty>{day ? 'Sem eventos neste dia.' : 'Sem eventos neste mês.'}</Empty>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
