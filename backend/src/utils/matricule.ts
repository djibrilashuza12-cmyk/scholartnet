export function generateMatriculeFormatXxx000000Xxx00(randomBytes: () => number = Math.random): string {
    // Format exact: xxx-000000-xxx-00
    const pad = (n: number, width: number) => String(n).padStart(width, '0');

    const part1 = pad(Math.floor(randomBytes() * 1000), 3);
    const part2 = pad(Math.floor(randomBytes() * 1000000), 6);
    const part3 = pad(Math.floor(randomBytes() * 1000), 3);
    const part4 = pad(Math.floor(randomBytes() * 100), 2);

    return `${part1}-${part2}-${part3}-${part4}`;
}

