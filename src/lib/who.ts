// Who is using this phone (prototype: picked on the Home page, no login; a real version uses a PIN set by the owner).
// Owner sees everything and decides. Dispatch makes the truck list and papers. Store loads and unloads at the dock and counts.
export const WHO: Record<string, { label: string; what: string; main: string; views: string[] }> = {
  owner: { label: 'Owner', what: 'Sees everything. Decides on differences, approves staff requests, gets the day\'s summary and the Tally file.', main: 'owner', views: ['home', 'dispatch', 'receive', 'owner', 'reports'] },
  dispatch: { label: 'Dispatch', what: 'Office person. Makes the list of what goes on the truck, the papers (challan, e-way bill), taps Truck left, sends the link to outside parties.', main: 'dispatch', views: ['home', 'dispatch'] },
  store: { label: 'Store', what: 'Person at the dock, at any unit. Loads trucks that leave (loading start and end), unloads and counts trucks that arrive.', main: 'receive', views: ['home', 'receive'] },
};
// Kept only while the page is open: every refresh starts on Home with nobody chosen (demo).
let current = '';
export const getWho = () => current;
export const setWhoSaved = (w: string) => { current = WHO[w] ? w : ''; };
