import { ChartNoAxesColumn, HeartIcon, MessageCircle, Repeat } from "lucide-react";
import { useEffect, useState } from "react";
import elonPfp from "@/assets/twitterPfps/elonPfp.jpg";
import polygonPfp from "@/assets/twitterPfps/polygonPfp.jpg";
import kfcPfp from "@/assets/twitterPfps/kfcPfp.jpg";
import ayushmanPfp from "@/assets/twitterPfps/ayushmanPfp.jpg";
import dikshitPfp from "@/assets/twitterPfps/dikshitPfp.jpg";
import subhraneelPfp from "@/assets/twitterPfps/subhraneelPfp.jpg";
import deepakPfp from "@/assets/twitterPfps/deepakPfp.jpg";

interface TweetStats {
  comments: string;
  retweets: string;
  likes: string;
  views: string;
}

interface Tweet {
  id: string;
  author: string;
  handle: string;
  content: string;
  time: string;
  pfp: ImageMetadata | null;
  stats: TweetStats;
}

const TWEETS_DATA: Tweet[] = [
  {
    id: "tweet-elon",
    author: "Elon Musk",
    handle: "@elonmusk",
    content: 'UwU, it was such an honor to see the awesome @Intel fab in Oregon this week! Looking forward to a great partnership with @SpaceX & @Tesla, hehe!',
    time: "2h",
    pfp: elonPfp,
    stats: { comments: "42.8k", retweets: "89.3k", likes: "512k", views: "42M" },
  },
  {
    id: "tweet-polymarket",
    author: "Polymarket",
    handle: "@Polymarket",
    content: "Norway hold China woman. She spy? international community demand transparency regarding incident.",
    time: "45m",
    pfp: polygonPfp,
    stats: { comments: "1.2k", retweets: "3.4k", likes: "28k", views: "1.8M" },
  },
  {
    id: "tweet-kfc",
    author: "KFC",
    handle: "@kfc",
    content: "Doth thou still partake in the unrefined delight of consuming tenders in their most unadulterated state, devoid of sauce or seasoning of any kind?",
    time: "3h",
    pfp: kfcPfp,
    stats: { comments: "8.7k", retweets: "22k", likes: "156k", views: "5.2M" },
  },
  {
    id: "tweet-ayushman",
    author: "Aayushman Singh",
    handle: "@aayushman2703",
    content: "Me wake up. Me take exam. Me no like write at all. Me sleep only 2 hours last night. Me eat food. Me scroll phone. Me sleep again.",
    time: "6h",
    pfp: ayushmanPfp,
    stats: { comments: "47", retweets: "132", likes: "892", views: "12k" },
  },
  {
    id: "tweet-dikshit",
    author: "Dikshit Jain",
    handle: "@mahanot_dikshit",
    content: "I find myself with an extensive list of features I ardently desire to add to bangify.xyz, but my present obligations to work consume much of my time.",
    time: "1h",
    pfp: dikshitPfp,
    stats: { comments: "23", retweets: "67", likes: "410", views: "8.5k" },
  },
  {
    id: "tweet-subhraneel",
    author: "subhraneel",
    handle: "@subhraneeltwt",
    content: "Greetings, fair maiden destined to be my future spouse. I am presently devoted to the noble pursuit of crochet, crafting beauty solely for thy delight.",
    time: "4h",
    pfp: subhraneelPfp,
    stats: { comments: "156", retweets: "420", likes: "2.3k", views: "45k" },
  },
  {
    id: "tweet-sharpeye",
    author: "ShaRPeyE",
    handle: "@sharpeye_wnl",
    content: "lowkey just spent last nite doin some comp sci grind\n- tried some examples and they actually worked...",
    time: "30m",
    pfp: null,
    stats: { comments: "34", retweets: "89", likes: "567", views: "6.2k" },
  },
  {
    id: "tweet-deepak",
    author: "Deepak",
    handle: "@triorDeep",
    content: "Hawa Mahal bad. Too much crowd, so much trash, so much noise everywhere. Cannot even see the building properly. Me take pic and leave.",
    time: "5h",
    pfp: deepakPfp,
    stats: { comments: "12", retweets: "45", likes: "234", views: "4.1k" },
  },
];

const MAX_VISIBLE_CARDS = 4;
const SWIPE_INTERVAL_MS = 1500;
const SWIPE_DURATION_MS = 500;

export default function TweetStack() {
  const [cards, setCards] = useState<Tweet[]>(TWEETS_DATA);
  const [isSwiping, setIsSwiping] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (cards.length === 0) {
      return;
    }

    if (isSwiping) {
      timer = setTimeout(() => {
        setCards((prev) => {
          if (prev.length <= 1) {
            return prev;
          }
          return [...prev.slice(1), prev[0]];
        });
        setIsSwiping(false);
      }, SWIPE_DURATION_MS);
    } else {
      timer = setTimeout(() => {
        setIsSwiping(true);
      }, SWIPE_INTERVAL_MS);
    }

    return () => clearTimeout(timer);
  }, [cards.length, isSwiping]);

  return (
    <div className="flex items-center justify-center h-[360px] pl-15 md:pl-20">
      <div className="relative w-[320px] sm:w-[400px] h-[220px]">
        {cards.map((tweet, index) => {
          const isTopCard = index === 0;
          const isSwiped = isSwiping && isTopCard;
          const visualPos = isSwiping ? index - 1 : index;
          const clampedPos = Math.min(Math.max(visualPos, 0), MAX_VISIBLE_CARDS - 1);

          let translateX = 0;
          let translateY = 0;
          let opacity = 1;
          const zIndex = cards.length - index;

          if (isSwiped) {
            translateX = 400;
            opacity = 0;
          } else {
            translateX = -clampedPos * 20;
            translateY = -clampedPos * 20;
            if (visualPos >= MAX_VISIBLE_CARDS) {
              opacity = 0;
            }
          }

          return (
            <div
              key={tweet.id}
              className="absolute top-0 left-0 w-full p-4 bg-background border border-border  ease-out text-foreground rounded-[10px]"
              style={{
                transition: "transform 0.5s ease-out, opacity 0.5s ease-out",
                transform: `translate(${translateX}px, ${translateY}px)`,
                opacity,
                zIndex,
              }}
            >
              <div className="flex gap-3">

                {tweet.pfp ? (
                  <img
                    src={tweet.pfp.src}
                    alt={tweet.author}
                    className="w-10 h-10 rounded-full shrink-0 object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-[black] text-[white] text-sm font-medium">
                    {tweet.author.charAt(0)}
                  </div>
                )}

                <div className="flex flex-col min-w-0 justify-between h-[200px] md:h-[160px]">
                  <div>
                    <div className="flex gap-2 leading-[1.2em] items-center">
                      <p className="text-[15px] pt-[1px] truncate">{tweet.author}</p>
                      <p className="text-[14px] text-muted-foreground truncate">{tweet.handle}</p>
                      <div className="rounded-[50%] mt-[1px] h-[3px] w-[3px] bg-muted-foreground shrink-0" />
                      <p className="text-[14px] text-muted-foreground shrink-0">{tweet.time}</p>
                    </div>

                    <p className="text-[15px] mt-2 whitespace-pre-line">{tweet.content}</p>
                  </div>

                  <div className="flex items-center justify-between mt-4 text-muted-foreground">
                    <div className="flex items-center gap-1 font-[500]">
                      <MessageCircle size={15} />
                      <p className="text-[14px]">{tweet.stats.comments}</p>
                    </div>

                    <div className="flex items-center gap-1 font-[500]">
                      <Repeat size={15} />
                      <p className="text-[14px]">{tweet.stats.retweets}</p>
                    </div>

                    <div className="flex items-center gap-1 font-[500]">
                      <HeartIcon size={15} />
                      <p className="text-[14px]">{tweet.stats.likes}</p>
                    </div>

                    <div className="flex items-center gap-1 font-[500]">
                      <ChartNoAxesColumn size={15} />
                      <p className="text-[14px]">{tweet.stats.views}</p>
                    </div>
                  </div>
                </div>



              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
