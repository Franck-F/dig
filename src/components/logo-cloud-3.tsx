import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { cn } from "@/lib/utils";

type Logo = {
  name: string;
  /** Optional CSS font-family override for visual variety */
  fontFamily?: string;
  /** Optional font weight (default 700) */
  weight?: number;
  /** Optional italic flag */
  italic?: boolean;
  /** Optional letter-spacing override */
  letterSpacing?: string;
};

type LogoCloudProps = React.ComponentProps<"div"> & {
  logos: Logo[];
};

export function LogoCloud({ className, logos, ...props }: LogoCloudProps) {
  return (
    <div
      {...props}
      className={cn(
        "overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black,transparent)]",
        className
      )}
    >
      <InfiniteSlider gap={64} reverse duration={40} durationOnHover={120}>
        {logos.map((logo) => (
          <span
            key={`logo-${logo.name}`}
            className="pointer-events-none select-none whitespace-nowrap text-base md:text-lg"
            style={{
              color: '#545b7a',
              fontWeight: logo.weight ?? 700,
              fontStyle: logo.italic ? 'italic' : 'normal',
              fontFamily: logo.fontFamily,
              letterSpacing: logo.letterSpacing ?? '-0.01em',
              opacity: 0.75,
            }}
          >
            {logo.name}
          </span>
        ))}
      </InfiniteSlider>
    </div>
  );
}
