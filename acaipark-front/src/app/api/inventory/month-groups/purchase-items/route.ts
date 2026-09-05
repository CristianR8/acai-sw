import { forwardMonthGroups } from "../proxy";
export const GET = (request: Request) =>
  forwardMonthGroups(request, `/purchase-items${new URL(request.url).search}`);
