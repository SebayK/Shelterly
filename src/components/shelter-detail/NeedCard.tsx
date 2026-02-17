import type { NeedListItemDTO, NeedCategory, UrgencyLevel } from "../../types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface NeedCardProps {
  need: NeedListItemDTO;
}

// Polish labels for categories
const categoryLabels: Record<NeedCategory, string> = {
  food: "Karma",
  textiles: "Tekstylia",
  cleaning: "Środki czystości",
  medical: "Medyczne",
  toys: "Zabawki",
  other: "Inne",
};

// Polish labels and colors for urgency levels
const urgencyConfig: Record<
  UrgencyLevel,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  low: { label: "Niska", variant: "secondary" },
  normal: { label: "Normalna", variant: "outline" },
  high: { label: "Wysoka", variant: "default" },
  urgent: { label: "Pilna", variant: "destructive" },
  critical: { label: "Krytyczna", variant: "destructive" },
};

// Polish labels for units
const unitLabels: Record<string, string> = {
  kg: "kg",
  pieces: "szt.",
  liters: "l",
  packages: "op.",
};

export function NeedCard({ need }: NeedCardProps) {
  const progressPercentage = (need.current_quantity / need.target_quantity) * 100;
  const isFulfilled = need.is_fulfilled;
  const urgencyInfo = urgencyConfig[need.urgency];

  return (
    <Card className={`flex flex-col h-full ${isFulfilled ? "opacity-60" : ""}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant="outline" className="text-xs">
            {categoryLabels[need.category]}
          </Badge>
          <Badge variant={urgencyInfo.variant} className="text-xs">
            {urgencyInfo.label}
          </Badge>
        </div>
        <CardTitle className="text-lg line-clamp-2">{need.title}</CardTitle>
        {need.description && <CardDescription className="line-clamp-3">{need.description}</CardDescription>}
      </CardHeader>

      <CardContent className="flex-1">
        <div className="space-y-3">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Postęp</span>
              <span className="font-medium text-gray-900">
                {need.current_quantity} / {need.target_quantity} {unitLabels[need.unit] || need.unit}
              </span>
            </div>
            <Progress
              value={progressPercentage}
              className="h-2"
              aria-label={`Postęp zbiórki: ${need.current_quantity} z ${need.target_quantity} ${unitLabels[need.unit] || need.unit}`}
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
            <p className="text-xs text-gray-500 mt-1">{Math.round(progressPercentage)}% zrealizowane</p>
          </div>

          {/* Fulfilled Badge */}
          {isFulfilled && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded-md">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm font-medium">Zrealizowane</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <p className="text-sm text-gray-500 italic w-full text-center">
          {isFulfilled ? "Potrzeba zrealizowana" : "Skontaktuj się ze schroniskiem"}
        </p>
      </CardFooter>
    </Card>
  );
}
