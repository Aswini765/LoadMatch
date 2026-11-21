// Who is using this phone (prototype: picked on the Home page, no login; a real version uses a PIN set by the owner).
// Two people: Staff (one at each unit: makes the list, loads, sends, and counts what arrives) and the Owner (sees all, decides).
export const WHO: Record<string, { label: string; what: string; main: string; views: string[] }> = {
  owner: { label: 'Owner', what: 'Sees everything. Decides on differences, approves staff requests, adds items, parties and staff.', main: 'owner', views: ['home', 'staff', 'dispatch', 'receive', 'owner', 'reports', 'setup'] },
  staff: { label: 'Staff', what: 'One person at each unit. Sends stock (list, load, truck left) and receives stock (counts what arrived).', main: 'staff', views: ['home', 'staff', 'dispatch', 'receive'] },
};
// Kept only while the page is open: every refresh starts on Home with nobody chosen (demo).
let current = '';
let unit = 'MYS';
export const getWho = () => current;
export const setWhoSaved = (w: string) => { current = WHO[w] ? w : ''; };
// The unit this staff phone belongs to (demo: switch to play the other end of the truck)
export const getUnit = () => unit;
export const setUnit = (u: string) => { unit = u; };
// The name written into the history for what this phone does ("Ravi (staff)" or "Owner")
let name = '';
export const setMeName = (n: string) => { name = n; };
export const me = () => (current === 'owner' ? 'Owner' : `${name || 'Staff'} (staff)`);
