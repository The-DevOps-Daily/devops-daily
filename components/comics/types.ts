export type ComicDialogue = {
  id: string;
  speaker: string;
  text: string;
  position: { x: number; y: number; width: number };
  tailDirection?: 'down-left' | 'down-right';
  /** Image-space endpoint, placed just short of the speaker's silhouette. */
  tailTo?: { x: number; y: number };
};

export type ComicSceneContent = {
  id: string;
  caption?: string;
  label?: string;
  artwork: {
    src: string;
    sources: { src: string; width: number }[];
    width: number;
    height: number;
    alt: string;
  };
  dialogue: ComicDialogue[];
  diagram?: 'shutdown-request';
};

export type ComicChapterContent = {
  title: string;
  description: string;
  volume: string;
  scenes: ComicSceneContent[];
  technicalNotes: {
    lead: string;
    paragraphs: string[];
    caveats: string[];
    footer: string;
    links: { label: string; href: string }[];
  };
};
