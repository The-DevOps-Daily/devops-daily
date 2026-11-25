// Shared by the guide overview and chapter pages, so moving between them does
// not shift the layout. On 2xl the page is wider than the site header: the
// sidebars get the extra room, and the article stays near 80 characters per
// line (globals.css sets .prose to max-width: none, hence the !important).
export const guideLayout = {
  container: 'container px-4 py-8 mx-auto 2xl:max-w-[1520px]',
  grid: 'grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:gap-10',
  row: 'flex flex-col gap-8 lg:flex-row 2xl:gap-10',
  nav: 'shrink-0 lg:w-80',
  article: 'flex-1 min-w-0 prose 2xl:mx-auto 2xl:max-w-[48rem]!',
};
