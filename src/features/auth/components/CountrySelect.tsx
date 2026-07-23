import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  COUNTRIES,
  callingCodeOf,
  countryFlag,
  countryName,
  type CountryCode,
} from '@/shared/lib/phone';

interface CountrySelectProps {
  value?: CountryCode;
  onChange: (country: CountryCode) => void;
  disabled?: boolean;
}

/**
 * 국가 선택.
 *
 * 245개라 그냥 늘어놓으면 못 고른다. 그래서 셀렉트가 아니라 **검색이 붙은 목록**이다.
 * 나라 이름·영문 코드·국가번호 아무거나로 걸린다 — `한국`, `KR`, `82` 가 다 같은 줄을
 * 찾아낸다. 사람마다 떠올리는 단서가 다르다.
 */
export function CountrySelect({ value, onChange, disabled }: CountrySelectProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en-us';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const items = useMemo(
    () =>
      COUNTRIES.map((code) => ({
        code,
        name: countryName(code, lang),
        calling: callingCodeOf(code),
      })).sort((a, b) => a.name.localeCompare(b.name, lang)),
    [lang],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '');
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        i.calling.startsWith(q),
    );
  }, [items, query]);

  const current = value ? items.find((i) => i.code === value) : undefined;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // 다음에 열 때 지난 검색어가 남아 있으면 목록이 비어 보인다.
        if (!next) setQuery('');
      }}
    >
      <Popover.Trigger
        type="button"
        disabled={disabled}
        aria-label={t('auth.phone.country')}
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {current ? (
          <>
            <span aria-hidden>{countryFlag(current.code)}</span>
            <span className="tabular-nums">+{current.calling}</span>
          </>
        ) : (
          <span className="text-slate-400">{t('auth.phone.country')}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('auth.phone.countrySearch')}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(item.code);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm transition-colors hover:bg-slate-100',
                    item.code === value && 'font-bold',
                  )}
                >
                  <span aria-hidden className="shrink-0">
                    {countryFlag(item.code)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">+{item.calling}</span>
                  <Check
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-primary',
                      item.code === value ? 'visible' : 'invisible',
                    )}
                  />
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-slate-400">
                {t('auth.phone.countryEmpty')}
              </li>
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
