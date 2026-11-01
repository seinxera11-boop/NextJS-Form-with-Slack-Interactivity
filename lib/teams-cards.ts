import {
  ActionSet,
  AdaptiveCard,
  ExecuteAction,
  TextBlock,
  TextInput,
} from "@microsoft/teams.cards";

/**
 * Teams equivalent of the Block Kit approval message in /api/checklist.
 *
 * `withAssociatedInputs("auto")` is what makes the `reason` input travel with
 * the button; without it the handler would always see the fallback comment.
 * Every TextBlock sets `wrap` because Adaptive Cards clip by default and the
 * missing-items list is multi-line Japanese text.
 */
export function buildApprovalCard(opts: {
  responseId: number;
  checklistId: number;
  submittedBy: string;
  departmentName: string;
  bodyText: string;
}) {
  return new AdaptiveCard(
    new TextBlock(
      `${opts.departmentName}の ${opts.submittedBy} さんから新しい提出があります`,
      { size: "Large", weight: "Bolder", wrap: true }
    ),
    new TextBlock(opts.bodyText, { wrap: true }),
    new TextInput({ id: "reason" }).withLabel("承認の理由を教えてください"),
    new ActionSet(
      new ExecuteAction({ title: "承認" })
        .withData({
          verb: "approve",
          response_id: opts.responseId,
          checklist_id: opts.checklistId,
          submitted_by: opts.submittedBy,
        })
        .withAssociatedInputs("auto")
    )
  );
}
