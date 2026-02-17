import type { NeedCategory, UrgencyLevel } from "../../types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface NeedsFilterProps {
  onCategoryChange: (category: NeedCategory | "all") => void;
  onUrgencyChange: (urgency: UrgencyLevel | "all") => void;
  currentCategory: NeedCategory | "all";
  currentUrgency: UrgencyLevel | "all";
}

// Polish labels for categories
const categoryLabels: Record<NeedCategory | "all", string> = {
  all: "Wszystkie kategorie",
  food: "Karma",
  textiles: "Tekstylia",
  cleaning: "Środki czystości",
  medical: "Medyczne",
  toys: "Zabawki",
  other: "Inne",
};

// Polish labels for urgency levels
const urgencyLabels: Record<UrgencyLevel | "all", string> = {
  all: "Wszystkie poziomy",
  low: "Niska",
  normal: "Normalna",
  high: "Wysoka",
  urgent: "Pilna",
  critical: "Krytyczna",
};

export function NeedsFilter({ onCategoryChange, onUrgencyChange, currentCategory, currentUrgency }: NeedsFilterProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Category Filter */}
      <div className="space-y-2">
        <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
          Kategoria
        </label>
        <Select value={currentCategory} onValueChange={onCategoryChange}>
          <SelectTrigger id="category-filter" className="w-full">
            <SelectValue placeholder="Wybierz kategorię" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{categoryLabels.all}</SelectItem>
            <SelectItem value="food">{categoryLabels.food}</SelectItem>
            <SelectItem value="textiles">{categoryLabels.textiles}</SelectItem>
            <SelectItem value="cleaning">{categoryLabels.cleaning}</SelectItem>
            <SelectItem value="medical">{categoryLabels.medical}</SelectItem>
            <SelectItem value="toys">{categoryLabels.toys}</SelectItem>
            <SelectItem value="other">{categoryLabels.other}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Urgency Filter */}
      <div className="space-y-2">
        <label htmlFor="urgency-filter" className="text-sm font-medium text-gray-700">
          Pilność
        </label>
        <Select value={currentUrgency} onValueChange={onUrgencyChange}>
          <SelectTrigger id="urgency-filter" className="w-full">
            <SelectValue placeholder="Wybierz pilność" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{urgencyLabels.all}</SelectItem>
            <SelectItem value="low">{urgencyLabels.low}</SelectItem>
            <SelectItem value="normal">{urgencyLabels.normal}</SelectItem>
            <SelectItem value="high">{urgencyLabels.high}</SelectItem>
            <SelectItem value="urgent">{urgencyLabels.urgent}</SelectItem>
            <SelectItem value="critical">{urgencyLabels.critical}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
