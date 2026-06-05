import Image from "next/image";

export function LogoMark() {
  return (
    <div className="flex items-center gap-3">
      <Image src="/brand/abc-logo.webp" alt="ABC Consulting" width={130} height={48} priority />
    </div>
  );
}
