// The routes the invariants run against. When you add a page, add its route
// here, or the invariants stop covering it. /courses/COMP3620/ stands in for
// every course page (they share one template); the not-found branch answers
// 404, so spec/planner.test.ts checks it instead.
export const ROUTES = ["/", "/courses/", "/courses/COMP3620/", "/plan/", "/readme/"];
