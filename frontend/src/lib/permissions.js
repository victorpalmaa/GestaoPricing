import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

export const ROUTE_PERMISSIONS = {
  "/pricing/dashboard": {
    allowedAreas: ["Pricing", "Pré-vendas", "CS"],
    writeAreas: ["Pricing"],
  },
  "/pricing/analytics": {
    allowedAreas: ["Pricing", "Pré-vendas", "CS"],
    writeAreas: ["Pricing"],
  },
  "/new-business": {
    allowedAreas: ["Pricing", "Pré-vendas", "CS"],
    writeAreas: ["Pricing", "Pré-vendas", "CS"],
  },
  "/business-development": {
    allowedAreas: ["Pricing", "CS"],
    writeAreas: ["Pricing", "CS"],
  },
  "/simulacao": {
    allowedAreas: ["Pricing", "Pré-vendas", "CS"],
    writeAreas: ["Pricing", "Pré-vendas", "CS"],
  },
  "/catalogo-pro": {
    allowedAreas: ["Pricing", "Pré-vendas", "CS"],
    writeAreas: ["Pricing"],
  },
  "/combos-feiras-2026": {
    allowedAreas: ["Pricing", "Pré-vendas", "CS"],
    writeAreas: ["Pricing", "Pré-vendas", "CS"],
  },
  "/pre-vendas/new-leads": {
    allowedAreas: ["Pricing", "Pré-vendas", "CS"],
    writeAreas: ["Pricing", "Pré-vendas", "CS"],
  },
  "/cs": {
    allowedAreas: ["Pricing", "CS"],
    writeAreas: ["Pricing", "CS"],
  },
};

export function getAllowedAreasForRoute(route) {
  return ROUTE_PERMISSIONS[route]?.allowedAreas || [];
}

export function getWriteAreasForRoute(route) {
  return ROUTE_PERMISSIONS[route]?.writeAreas || [];
}

export function hasAreaAccessToRoute(area, route) {
  const allowedAreas = getAllowedAreasForRoute(route);

  if (!area || !String(area).trim()) {
    return false;
  }

  return allowedAreas.includes(area);
}

export function canAreaWriteToRoute(area, route) {
  const writeAreas = getWriteAreasForRoute(route);

  if (!area || !String(area).trim()) {
    return false;
  }

  return writeAreas.includes(area);
}

export function useRoutePermissions(route) {
  const { area } = useAuth();

  return useMemo(() => ({
    area,
    allowedAreas: getAllowedAreasForRoute(route),
    writeAreas: getWriteAreasForRoute(route),
    hasAccess: hasAreaAccessToRoute(area, route),
    canWrite: canAreaWriteToRoute(area, route),
  }), [area, route]);
}
