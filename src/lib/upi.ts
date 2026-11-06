/** A UPI deep link any UPI app can scan. The amount is fixed so nobody mistypes it. */
export function upiPayLink(opts: { vpa: string; payeeName: string; amountPaise: number; note: string }): string {
  const params = new URLSearchParams({
    pa: opts.vpa,
    pn: opts.payeeName.slice(0, 40),
    am: (opts.amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: opts.note.slice(0, 60),
  });
  return `upi://pay?${params.toString()}`;
}

export function isValidVpa(vpa: string): boolean {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(vpa);
}
