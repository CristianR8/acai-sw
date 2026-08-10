import Image from "next/image";

export function Logo() {
  return (
    <div className="relative mx-auto h-32 w-32">
      <Image
        src="/images/logo/LogoAP.jpg"
        fill
        className="rounded-full object-contain dark:hidden"
        alt="ACAI PARK SOFTWARE"
        role="presentation"
        quality={100}
      />

      <Image
        src="/images/logo/LogoAP.jpg"
        fill
        className="hidden rounded-full object-contain dark:block"
        alt="ACAI PARK SOFTWARE"
        role="presentation"
        quality={100}
      />
    </div>
  );
}
