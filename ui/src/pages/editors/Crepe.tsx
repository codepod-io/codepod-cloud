import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";

// // We have some themes for you to choose
import "@milkdown/crepe/theme/frame.css";
import { useCallback, useEffect, useRef } from "react";

// console.log("??????");

// const root = document.getElementById("mymilkdown");
// console.log("root", root);

// export const crepe = new Crepe({
//   root: document.getElementById("mymilkdown"),
//   defaultValue: "Hello, Milkdown!",
// });

const markdown2 = `# Milkdown Editor Crepe

> This is a demo for using [Milkdown](https://milkdown.dev) editor crepe.

Let's add some content to the editor.

\`\`\`javascript
console.log("Hello, Milkdown!");
\`\`\`

---

# Pink Floyd

![1.0](https://upload.wikimedia.org/wikipedia/en/d/d6/Pink_Floyd_-_all_members.jpg "Pink Floyd in January 1968.")

> Rarely will you find Floyd dishing up catchy hooks, tunes short enough for air-play, or predictable three-chord blues progressions; and never will you find them spending much time on the usual pop album of romance, partying, or self-hype. Their sonic universe is expansive, intense, and challenging ... Where most other bands neatly fit the songs to the music, the two forming a sort of autonomous and seamless whole complete with memorable hooks, Pink Floyd tends to set lyrics within a broader soundscape that often seems to have a life of its own ... Pink Floyd employs extended, stand-alone instrumentals which are never mere vehicles for showing off virtuoso but are planned and integral parts of the performance.

**Pink Floyd** are an English [rock](https://en.wikipedia.org/wiki/Rock_music "Rock music") band formed in London in 1965. Gaining an early following as one of the first British [psychedelic](https://en.wikipedia.org/wiki/Psychedelic_music "Psychedelic music") groups, they were distinguished by their extended compositions, sonic experiments, philosophical lyrics, and elaborate [live shows](https://en.wikipedia.org/wiki/Pink_Floyd_live_performances "Pink Floyd live performances"). They became a leading band of the [progressive rock](https://en.wikipedia.org/wiki/Progressive_rock "Progressive rock") genre, cited by some as the greatest progressive rock band of all time.

Pink Floyd were founded in 1965 by [Syd Barrett](https://en.wikipedia.org/wiki/Syd_Barrett "Syd Barrett") (guitar, lead vocals), [Nick Mason](https://en.wikipedia.org/wiki/Nick_Mason "Nick Mason") (drums), [Roger Waters](https://en.wikipedia.org/wiki/Roger_Waters "Roger Waters") (bass guitar, vocals) and [Richard Wright](https://en.wikipedia.org/wiki/Richard_Wright_\\(musician\\) "Richard Wright (musician)") (keyboards, vocals). With Barrett as their main songwriter, they released two hit singles, "[Arnold Layne](https://en.wikipedia.org/wiki/Arnold_Layne "Arnold Layne")" and "[See Emily Play](https://en.wikipedia.org/wiki/See_Emily_Play "See Emily Play")", and the successful debut album *[The Piper at the Gates of Dawn](https://en.wikipedia.org/wiki/The_Piper_at_the_Gates_of_Dawn "The Piper at the Gates of Dawn")* (all 1967). [David Gilmour](https://en.wikipedia.org/wiki/David_Gilmour "David Gilmour") (guitar, vocals) joined in December 1967, while Barrett left in April 1968 due to deteriorating mental health. The four remaining members began contributing to the musical composition, with Waters becoming the primary lyricist and thematic leader, devising the [concepts](https://en.wikipedia.org/wiki/Concept_album "Concept album") behind Pink Floyd's most successful albums, *[The Dark Side of the Moon](https://en.wikipedia.org/wiki/The_Dark_Side_of_the_Moon "The Dark Side of the Moon")* (1973), *[Wish You Were Here](https://en.wikipedia.org/wiki/Wish_You_Were_Here_\\(Pink_Floyd_album\\) "Wish You Were Here (Pink Floyd album)")* (1975), *[Animals](https://en.wikipedia.org/wiki/Animals_\\(Pink_Floyd_album\\))* (1977) and *[The Wall](https://en.wikipedia.org/wiki/The_Wall "The Wall")* (1979). The [musical film](https://en.wikipedia.org/wiki/Musical_film "Musical film") based on *The Wall*, *[Pink Floyd – The Wall](https://en.wikipedia.org/wiki/Pink_Floyd_%E2%80%93_The_Wall "Pink Floyd – The Wall")* (1982), won two [BAFTA Awards](https://en.wikipedia.org/wiki/BAFTA_Awards "BAFTA Awards"). Pink Floyd also composed several [film scores](https://en.wikipedia.org/wiki/Film_score "Film score").

---

## Discography

*Main articles: [Pink Floyd discography](https://en.wikipedia.org/wiki/Pink_Floyd_discography "Pink Floyd discography") and [List of songs recorded by Pink Floyd](https://en.wikipedia.org/wiki/List_of_songs_recorded_by_Pink_Floyd "List of songs recorded by Pink Floyd")*

**Studio albums**

* *[The Piper at the Gates of Dawn](https://en.wikipedia.org/wiki/The_Piper_at_the_Gates_of_Dawn "The Piper at the Gates of Dawn")* (1967)
* *[A Saucerful of Secrets](https://en.wikipedia.org/wiki/A_Saucerful_of_Secrets "A Saucerful of Secrets")* (1968)
* *[More](https://en.wikipedia.org/wiki/More_\\(soundtrack\\) "More (soundtrack)")* (1969)
* *[Ummagumma](https://en.wikipedia.org/wiki/Ummagumma "Ummagumma")* (1969)
* *[Atom Heart Mother](https://en.wikipedia.org/wiki/Atom_Heart_Mother "Atom Heart Mother")* (1970)
* *[Meddle](https://en.wikipedia.org/wiki/Meddle "Meddle")* (1971)
* *[Obscured by Clouds](https://en.wikipedia.org/wiki/Obscured_by_Clouds "Obscured by Clouds")* (1972)
* *[The Dark Side of the Moon](https://en.wikipedia.org/wiki/The_Dark_Side_of_the_Moon "The Dark Side of the Moon")* (1973)
* *[Wish You Were Here](https://en.wikipedia.org/wiki/Wish_You_Were_Here_\\(Pink_Floyd_album\\) "Wish You Were Here (Pink Floyd album)")* (1975)
* *[Animals](https://en.wikipedia.org/wiki/Animals_\\(Pink_Floyd_album\\) "Animals (Pink Floyd album)")* (1977)
* *[The Wall](https://en.wikipedia.org/wiki/The_Wall "The Wall")* (1979)
* *[The Final Cut](https://en.wikipedia.org/wiki/The_Final_Cut_\\(album\\) "The Final Cut (album)")* (1983)
* *[A Momentary Lapse of Reason](https://en.wikipedia.org/wiki/A_Momentary_Lapse_of_Reason "A Momentary Lapse of Reason")* (1987)
* *[The Division Bell](https://en.wikipedia.org/wiki/The_Division_Bell "The Division Bell")* (1994)
* *[The Endless River](https://en.wikipedia.org/wiki/The_Endless_River "The Endless River")* (2014)

`;

import { githubLight } from "@uiw/codemirror-theme-github";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { cmAPI, crepeAPI, markdown } from "./atom";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { throttle } from "lodash";
import { useAtomCallback } from "jotai/utils";
import { block, blockConfig } from "@milkdown/kit/plugin/block";
import { getMarkdown } from "@milkdown/kit/utils";

import { compressToBase64, decompressFromBase64 } from "lz-string";
import { editorViewCtx, parserCtx } from "@milkdown/kit/core";
import { Slice } from "@milkdown/kit/prose/model";
import { Selection } from "@milkdown/kit/prose/state";

const encode = compressToBase64;

const decode = decompressFromBase64;

// Make a react component for the editor
export const CrepeEditor: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const crepe = useRef<Crepe>();

  const [content, setContent] = useAtom(markdown);

  setContent(markdown2);

  const setCrepeAPI = useSetAtom(crepeAPI);

  const onMilkdownChange = useAtomCallback(
    useCallback((get, _set, markdown: string) => {
      const cmAPIValue = get(cmAPI);
      // const lock = get(focus) === "cm";
      // if (lock) return;

      cmAPIValue.update(markdown);
      // setContent(markdown);
    }, [])
  );

  useEffect(() => {
    const div = ref.current;
    if (!div) {
      return;
    }
    crepe.current = new Crepe({
      root: div,
      // root: document.getElementById("mymilkdown"),
      // defaultValue: "Hello, Milkdown!",
      // defaultValue: markdown,
      defaultValue: content,
      features: {
        "code-mirror": true,
      },
      featureConfigs: {
        [Crepe.Feature.LinkTooltip]: {},
        [Crepe.Feature.CodeMirror]: {
          theme: githubLight,
        },
        [Crepe.Feature.BlockEdit]: {},
      },
    });

    crepe.current.editor
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          // onChange(markdown);
          onMilkdownChange(markdown);
        });
        ctx.set(blockConfig.key, {
          filterNodes: (pos) => {
            // const filter = findParent((node) =>
            //   ["table", "blockquote"].includes(node.type.name)
            // )(pos);
            // if (filter) return false;

            return true;
          },
        });
      })
      .use(listener)
      .use(block);

    crepe.current.create().then(() => {
      console.log("Editor created");
    });

    console.log("set");
    setCrepeAPI({
      loaded: true,
      onShare: () => {
        if (!crepe.current) return;
        const content = crepe.current.editor.action(getMarkdown());
        const base64 = encode(content);

        const url = new URL(location.href);
        url.searchParams.set("text", base64);
        // navigator.clipboard.writeText(url.toString()).then(() => {
        //   toast("Share link copied.", "success");
        // });
        window.history.pushState({}, "", url.toString());
      },
      update: (markdown: string) => {
        console.log("111");
        if (!crepe.current) return;
        console.log("222");
        crepe.current.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const parser = ctx.get(parserCtx);
          const doc = parser(markdown);
          if (!doc) return;
          const state = view.state;
          const selection = state.selection;
          const { from } = selection;
          let tr = state.tr;
          tr = tr.replace(
            0,
            state.doc.content.size,
            new Slice(doc.content, 0, 0)
          );
          tr = tr.setSelection(Selection.near(tr.doc.resolve(from)));
          view.dispatch(tr);
        });
      },
    });

    return () => {
      console.log("unset");
      crepe.current?.destroy();
      setCrepeAPI({
        loaded: true,
        onShare: () => {},
        update: () => {},
      });
    };
  }, []);

  return (
    <div
      style={
        {
          // border: "1px solid black",
          // margin: "auto",
          // width: "1000px",
        }
      }
      ref={ref}
    />
  );
};
