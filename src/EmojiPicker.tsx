import { useState } from 'react'

type Props = { name: string; options: string[]; defaultValue?: string | null; label: string }

// Posts the chosen emoji through a hidden input, so it works inside a plain <form>.
export function EmojiPicker({ name, options, defaultValue, label }: Props) {
  const initial = defaultValue || options[0]
  const [value, setValue] = useState(initial)
  // keep an emoji that is not in the list (pasted before the picker existed)
  const all = options.includes(initial) ? options : [initial, ...options]

  return (
    <div className="emoji-picker" role="radiogroup" aria-label={label}>
      <input type="hidden" name={name} value={value} />
      {all.map((e) => (
        <button type="button" key={e} role="radio" aria-checked={e === value} aria-label={e} onClick={() => setValue(e)}>
          {e}
        </button>
      ))}
    </div>
  )
}
