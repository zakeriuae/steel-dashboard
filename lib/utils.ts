import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRowMetadata(values: Record<string, string>): { sender: string; date: string } {
  let sender = "";
  let date = "";

  const senderKeys = ["sender", "from", "name", "user", "username", "فرستنده", "نام", "نویسنده", "owner", "creator"];
  const dateKeys = ["timestamp", "date", "time", "datetime", "تاریخ", "زمان", "ثبت"];

  for (const [key, val] of Object.entries(values ?? {})) {
    const lowerKey = key.toLowerCase().trim();
    if (!sender && senderKeys.some(k => lowerKey.includes(k) || k.includes(lowerKey))) {
      sender = val.trim();
    }
    if (!date && dateKeys.some(k => lowerKey.includes(k) || k.includes(lowerKey))) {
      date = val.trim();
    }
  }

  return { sender, date };
}
