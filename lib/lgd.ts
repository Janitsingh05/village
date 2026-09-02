/**
 * Links into the government's own record of who runs a panchayat.
 *
 * There is no public API to call here — the Local Government Directory and the
 * state panchayat portals are meant to be read by people, and the ones that do
 * expose data want a registered key. So this does the honest thing and hands
 * the super admin the right page to open, with the search already framed. The
 * check stays manual; what the app contributes is making it one tap instead of
 * ten minutes of hunting.
 */

/**
 * A web search scoped to the government domains that actually publish this.
 *
 * Deliberately a search rather than a deep link: the state portals move their
 * URLs constantly, and a dead link is worse than a query that still works.
 */
export function directorySearchUrl(input: {
  villageName: string;
  district: string;
  state: string;
  lgdCode?: string;
}): string {
  const terms = [
    input.lgdCode ? 'LGD ' + input.lgdCode : '',
    input.villageName,
    input.district,
    input.state,
    'gram panchayat sarpanch',
  ]
    .filter(Boolean)
    .join(' ');

  return 'https://www.google.com/search?q=' + encodeURIComponent(terms);
}

/**
 * What a super admin should have in front of them before approving. Rendered as
 * a checklist rather than enforced: a rule that can be satisfied by ticking a
 * box teaches people to tick boxes, so this is a prompt to actually look, and
 * the note they write afterwards is what gets stored.
 */
export const VERIFICATION_STEPS = [
  'super.checkId',
  'super.checkPost',
  'super.checkDirectory',
  'super.checkCall',
] as const;
