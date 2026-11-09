// Feature flags of this fork (DESIGN_PLAN step 5, PLAN.md Phase 7).
//
// FRIENDS_SCREEN  the Friends tab and screen. On: it shows the layout with an honest empty state
//                 ("Invite friends") and never made-up people.
// FRIENDS_API     whether the server has friends, leaderboards and nudges yet. Off until Phase 7
//                 builds them; the screen then loads real data instead of the empty state.
export const FRIENDS_SCREEN = true
export const FRIENDS_API = false
