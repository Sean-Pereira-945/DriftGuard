import { SHORTCUT_LIST } from '../lib/shortcuts';
import { Modal } from './Overlay';

/** Reference list of keyboard shortcuts. */
export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" description="Press g, then the second key, to jump between views.">
      <ul className="divide-y divide-hairline">
        {SHORTCUT_LIST.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-[15px] text-body">{item.label}</span>
            <span className="flex gap-1">
              {item.keys.map((key, index) => (
                <kbd
                  key={index}
                  className="min-w-7 rounded-sm border border-hairline-strong bg-raised px-2 py-0.5 text-center font-mono text-[13px] text-ink"
                >
                  {key}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">Shortcuts are off while you type in a field or have a dialog open.</p>
    </Modal>
  );
}
