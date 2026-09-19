import Image from "next/image";

export function BrandLogo() {
  return <Image src="/brand/laporpak-wordmark.webp" alt="LaporPak" width={512} height={138} sizes="208px" className="h-auto w-52 max-w-full" />;
}
