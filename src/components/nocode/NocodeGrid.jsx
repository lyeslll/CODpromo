import { Children } from "react";

/**
 * شبكة بطاقات بلا كود: عمودان (sm) ثم ثلاثة (lg).
 * rail: في الهاتف شريط سحب أفقي (scroll-snap أصلي، بلا JS) بدل العمود الواحد.
 */
export default function NocodeGrid({ rail = false, className = "", children }) {
  if (!rail) {
    return <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>{children}</div>;
  }
  return (
    <div
      className={`no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 ${className}`}
    >
      {Children.map(children, (child) => (
        <div className="grid w-[86%] max-w-[360px] shrink-0 snap-center sm:w-auto sm:max-w-none">{child}</div>
      ))}
    </div>
  );
}
