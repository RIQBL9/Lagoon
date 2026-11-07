/** Running total after each frame, or null where it can't be known yet. */
export function frameTotals(rolls: number[]): (number | null)[] {
  const out: (number | null)[] = [];
  let total = 0;
  let i = 0;
  let known = true;

  for (let f = 0; f < 10; f++) {
    const first = rolls[i];
    const second = rolls[i + 1];
    const third = rolls[i + 2];

    if (first === undefined) known = false;
    else if (first === 10) {
      if (second === undefined || third === undefined) known = false;
      else total += 10 + second + third;
      i += 1;
    } else {
      if (second === undefined) known = false;
      else if (first + second === 10) {
        if (third === undefined) known = false;
        else total += 10 + third;
      } else total += first + second;
      i += 2;
    }
    out.push(known ? total : null);
  }
  return out;
}

/** The little marks shown in each frame box: X, /, - or a number. */
export function frameMarks(rolls: number[]): string[][] {
  const marks: string[][] = [];
  let i = 0;
  const digit = (n: number) => (n === 0 ? "-" : String(n));

  for (let f = 0; f < 9; f++) {
    const a = rolls[i];
    if (a === undefined) {
      marks.push([]);
      continue;
    }
    if (a === 10) {
      marks.push(["", "X"]);
      i += 1;
      continue;
    }
    const b = rolls[i + 1];
    marks.push(b === undefined ? [digit(a)] : [digit(a), a + b === 10 ? "/" : digit(b)]);
    i += 2;
  }

  // Tenth frame: up to three rolls, and pins reset after a strike or spare.
  const tenth: string[] = [];
  let standing = 10;
  for (let r = 0; r < 3 && rolls[i + r] !== undefined; r++) {
    const n = rolls[i + r];
    if (n === standing && standing === 10) tenth.push("X");
    else if (n === standing) tenth.push("/");
    else tenth.push(digit(n));
    standing = n === standing ? 10 : standing - n;
  }
  marks.push(tenth);
  return marks;
}
