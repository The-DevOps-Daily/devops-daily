import type { ComicSceneContent } from '@/components/comics/types';

// Phase 4 contains only the opening scene. Dialogue follows the approved storyboard;
// placement is adjusted to the actual, uncropped proof artwork.
export const openingScene: ComicSceneContent = {
  id: 'scene-01',
  caption: 'Friday, 4:57 PM.',
  artwork: {
    src: '/comics/git-blame/chapter-01/scene-01.jpg',
    sources: [480, 960, 1122].map((width) => ({
      src: `/comics/git-blame/chapter-01/scene-01-${width}.webp`,
      width,
    })),
    width: 1122,
    height: 1402,
    alt: 'Sam turns from his laptop toward Maya at their neighboring desks. He gestures confidently; she rests her chin on her hand with an amused, skeptical smile. Afternoon light falls on a plant by the window.',
  },
  dialogue: [
    {
      id: 's01-sam',
      speaker: 'Sam',
      text: "It's literally a two-line change.",
      position: { x: 0.075, y: 0.065, width: 0.4 },
      tailDirection: 'down-right',
    },
    {
      id: 's01-maya',
      speaker: 'Maya',
      text: "That's what you said last Friday.",
      position: { x: 0.525, y: 0.205, width: 0.4 },
      tailDirection: 'down-left',
    },
  ],
};
