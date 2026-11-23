import { languages, setLang, useLang, useT, type Lang } from './i18n'

export function LanguagePicker() {
  const t = useT()
  return (
    <select className="language" aria-label={t.common.language} value={useLang()} onChange={(e) => setLang(e.target.value as Lang)}>
      {Object.entries(languages).map(([code, { name }]) => <option key={code} value={code}>🌐 {name}</option>)}
    </select>
  )
}
