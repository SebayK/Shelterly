import { Button } from "@/components/ui/button";

type MobileView = "map" | "list";

interface MobileViewToggleProps {
  currentView: MobileView;
  onViewChange: (view: MobileView) => void;
}

/**
 * Floating Action Button dla przełączania widoku na urządzeniach mobilnych
 * Widoczny tylko na mobile (ukryty na desktop przez Tailwind md:hidden)
 */
export function MobileViewToggle({ currentView, onViewChange }: MobileViewToggleProps) {
  return (
    <div className="md:hidden fixed bottom-6 right-6 z-50">
      <Button
        onClick={() => onViewChange(currentView === "map" ? "list" : "map")}
        className="rounded-full w-14 h-14 shadow-lg"
        aria-label={currentView === "map" ? "Przełącz na widok listy" : "Przełącz na widok mapy"}
      >
        {currentView === "map" ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            <line x1="9" y1="3" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="21" />
          </svg>
        )}
      </Button>
    </div>
  );
}
