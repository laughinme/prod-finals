export function PhotoUploadBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="absolute top-[10%] left-[8%] h-24 w-24 rotate-12 rounded-[20px] bg-[#1C1C1E] shadow-[0_16px_40px_rgba(0,0,0,0.12)] md:h-32 md:w-32 md:rounded-[28px]" />

      <div className="absolute top-[15%] right-[12%] -rotate-12 drop-shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
        <div className="relative h-12 w-12 rotate-45 bg-[#FFDD2D] before:absolute before:left-0 before:-top-1/2 before:h-full before:w-full before:rounded-full before:bg-[#FFDD2D] before:content-[''] after:absolute after:top-0 after:-left-1/2 after:h-full after:w-full after:rounded-full after:bg-[#FFDD2D] after:content-[''] md:h-16 md:w-16" />
      </div>

      <div className="absolute top-[5%] left-[45%] h-4 w-12 rotate-45 rounded-full bg-[#1C1C1E] shadow-[0_8px_20px_rgba(0,0,0,0.1)] md:h-5 md:w-16" />

      <div className="absolute top-[45%] left-[5%] -rotate-30 drop-shadow-[0_8px_20px_rgba(0,0,0,0.1)]">
        <div className="relative h-6 w-6 rotate-45 bg-[#1C1C1E] before:absolute before:left-0 before:-top-1/2 before:h-full before:w-full before:rounded-full before:bg-[#1C1C1E] before:content-[''] after:absolute after:top-0 after:-left-1/2 after:h-full after:w-full after:rounded-full after:bg-[#1C1C1E] after:content-[''] md:h-8 md:w-8" />
      </div>

      <div className="absolute top-[55%] right-[4%] h-16 w-16 rotate-45 rounded-2xl bg-[#FFDD2D] shadow-[0_12px_30px_rgba(0,0,0,0.08)] md:h-20 md:w-20" />

      <div className="absolute bottom-[15%] left-[12%] h-8 w-20 -rotate-12 rounded-full bg-[#FFDD2D] shadow-[0_12px_30px_rgba(0,0,0,0.08)] md:h-10 md:w-28" />

      <div className="absolute right-[10%] bottom-[15%] rotate-15 drop-shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
        <div className="relative h-16 w-16 rotate-45 bg-[#1C1C1E] before:absolute before:left-0 before:-top-1/2 before:h-full before:w-full before:rounded-full before:bg-[#1C1C1E] before:content-[''] after:absolute after:top-0 after:-left-1/2 after:h-full after:w-full after:rounded-full after:bg-[#1C1C1E] after:content-[''] md:h-20 md:w-20" />
      </div>

      <div className="absolute bottom-[5%] left-[50%] h-12 w-12 rounded-full bg-[#1C1C1E] shadow-[0_12px_30px_rgba(0,0,0,0.08)] md:h-16 md:w-16" />
    </div>
  );
}
