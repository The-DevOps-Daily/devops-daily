export type ComicDialogue = {
  id: string;
  speaker: string;
  text: string;
  position: { x: number; y: number; width: number };
  tailDirection?: 'down-left' | 'down-right';
};

export type ComicSceneContent = {
  id: string;
  caption: string;
  artwork: {
    src: string;
    sources: { src: string; width: number }[];
    width: number;
    height: number;
    alt: string;
  };
  dialogue: ComicDialogue[];
};
