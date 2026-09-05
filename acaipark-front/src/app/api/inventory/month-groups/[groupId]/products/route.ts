import { forwardMonthGroups } from "../../proxy";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  return forwardMonthGroups(
    request,
    `/${encodeURIComponent(groupId)}/products`,
  );
}
