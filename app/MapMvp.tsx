"use client";

import {
  ChevronDown,
  ChevronUp,
  LocateFixed,
  MessageCircle,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Reply = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  isMine: boolean;
};

type ThreadPost = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  votes: number;
  isMine: boolean;
  replies: Reply[];
};

type Topic = {
  id: string;
  title: string;
  summary: string;
  address: string;
  createdAt: string;
  lngLat: [number, number];
  isMine: boolean;
  posts: ThreadPost[];
};

const INITIAL_CENTER: [number, number] = [151.2093, -33.8688];
const INITIAL_ZOOM = 13.8;
const NEIGHBORHOOD_RADIUS_KM = 3;
const SAMPLE_TOPICS: Topic[] = [
  {
    id: "topic-1",
    title: "Club 77 queue and vibe",
    summary: "People are checking the line, door pace, and music before heading over.",
    address: "77 William St, Darlinghurst NSW",
    createdAt: "12 min ago",
    lngLat: [151.2132, -33.8791],
    isMine: false,
    posts: [
      {
        id: "post-1",
        author: "Mia",
        content: "Queue is moving pretty fast. Music sounds heavier than usual tonight.",
        createdAt: "12 min ago",
        votes: 18,
        isMine: false,
        replies: [
          {
            id: "reply-1",
            author: "Leo",
            content: "Can confirm, we got in after about ten minutes.",
            createdAt: "8 min ago",
            isMine: false,
          },
        ],
      },
      {
        id: "post-2",
        author: "You",
        content: "Might head there after dinner if the line stays reasonable.",
        createdAt: "4 min ago",
        votes: 5,
        isMine: true,
        replies: [],
      },
    ],
  },
  {
    id: "topic-2",
    title: "Rooftop bars with space",
    summary: "Looking for somewhere quieter for a first drink around the CBD.",
    address: "Sydney CBD, NSW",
    createdAt: "28 min ago",
    lngLat: [151.2059, -33.8654],
    isMine: false,
    posts: [
      {
        id: "post-3",
        author: "Jay",
        content: "This rooftop still has space, nice breeze, and the music is low enough to talk.",
        createdAt: "28 min ago",
        votes: 12,
        isMine: false,
        replies: [],
      },
    ],
  },
  {
    id: "topic-3",
    title: "Late food after the gig",
    summary: "Quick options nearby that are still serving after midnight.",
    address: "Surry Hills, NSW",
    createdAt: "41 min ago",
    lngLat: [151.2164, -33.8726],
    isMine: false,
    posts: [
      {
        id: "post-4",
        author: "Sophie",
        content: "Kitchen is still open and people are spilling in after the gig.",
        createdAt: "41 min ago",
        votes: 21,
        isMine: false,
        replies: [
          {
            id: "reply-2",
            author: "You",
            content: "Saving this, exactly what we need later.",
            createdAt: "17 min ago",
            isMine: true,
          },
        ],
      },
    ],
  },
];

function formatCoord(value: number) {
  return Number(value.toFixed(6));
}

function formatBounds(bounds: mapboxgl.LngLatBounds) {
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();

  return {
    north: formatCoord(northEast.lat),
    south: formatCoord(southWest.lat),
    east: formatCoord(northEast.lng),
    west: formatCoord(southWest.lng),
  };
}

function logCurrentBounds(map: mapboxgl.Map) {
  const bounds = map.getBounds();

  if (bounds) {
    console.log("Current map bounds:", formatBounds(bounds));
  }
}

function boundsAround([lng, lat]: [number, number], radiusKm: number): mapboxgl.LngLatBoundsLike {
  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));

  return [
    [lng - lngDelta, lat - latDelta],
    [lng + lngDelta, lat + latDelta],
  ];
}

function fitToNeighborhood(map: mapboxgl.Map, center: [number, number]) {
  map.fitBounds(boundsAround(center, NEIGHBORHOOD_RADIUS_KM), {
    duration: 800,
    maxZoom: 15,
    padding: 64,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function topicPopupHtml(topic: Topic) {
  return `<div class="map-popup"><strong>${escapeHtml(topic.title)}</strong><span>${escapeHtml(
    topic.address,
  )}</span><span>${topic.posts.length} posts · ${escapeHtml(topic.createdAt)}</span></div>`;
}

function createPinElement(tone: "mine" | "nearby" | "user") {
  const element = document.createElement("button");
  element.className = `nightlife-pin nightlife-pin-${tone}`;
  element.type = "button";
  element.setAttribute("aria-label", `${tone} location pin`);

  const dot = document.createElement("span");
  dot.className = "nightlife-pin-dot";
  element.appendChild(dot);

  return element;
}

function getClientId() {
  const storageKey = "nightlife-client-id";
  const existingId = window.localStorage.getItem(storageKey);

  if (existingId) {
    return existingId;
  }

  const nextId = crypto.randomUUID();
  window.localStorage.setItem(storageKey, nextId);

  return nextId;
}

function topicHeaders() {
  return {
    "Content-Type": "application/json",
    "x-nightlife-client-id": getClientId(),
  };
}

async function reverseGeocode(center: [number, number], token: string) {
  const [lng, lat] = center;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=address,poi,place,neighborhood&limit=1`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Reverse geocoding failed");
  }

  const data = (await response.json()) as { features?: Array<{ place_name?: string }> };

  return data.features?.[0]?.place_name ?? `${formatCoord(lat)}, ${formatCoord(lng)}`;
}

async function geocodeAddress(address: string, proximity: [number, number], token: string) {
  const [lng, lat] = proximity;
  const encodedAddress = encodeURIComponent(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${token}&country=au&proximity=${lng},${lat}&limit=1`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Address geocoding failed");
  }

  const data = (await response.json()) as { features?: Array<{ center?: [number, number]; place_name?: string }> };
  const feature = data.features?.[0];

  if (!feature?.center) {
    return null;
  }

  return {
    address: feature.place_name ?? address,
    lngLat: feature.center,
  };
}

export default function MapMvp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const topicMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [locationStatus, setLocationStatus] = useState("Use your location to center nearby");
  const [topics, setTopics] = useState<Topic[]>(SAMPLE_TOPICS);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAddress, setDraftAddress] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [addressStatus, setAddressStatus] = useState("");
  const [publishingTopic, setPublishingTopic] = useState(false);
  const [topicsStatus, setTopicsStatus] = useState("Loading local topics...");
  const [topicPostDraft, setTopicPostDraft] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [mapReady, setMapReady] = useState(false);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [selectedTopicId, topics],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadTopics() {
      try {
        const response = await fetch("/api/topics", {
          headers: topicHeaders(),
        });

        if (!response.ok) {
          throw new Error("Unable to load topics");
        }

        const data = (await response.json()) as { topics: Topic[] };

        if (isMounted) {
          setTopics(data.topics.length > 0 ? data.topics : SAMPLE_TOPICS);
          setTopicsStatus("Topics synced with backend");
        }
      } catch (error) {
        console.warn(error);

        if (isMounted) {
          setTopicsStatus("Using demo topics while backend is unavailable");
        }
      }
    }

    loadTopics();

    return () => {
      isMounted = false;
    };
  }, []);

  const locateUser = useCallback(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus("Location is unavailable in this browser");
      fitToNeighborhood(map, INITIAL_CENTER);
      return;
    }

    setLocationStatus("Finding your location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userCenter: [number, number] = [position.coords.longitude, position.coords.latitude];

        userMarkerRef.current?.remove();
        userMarkerRef.current = new mapboxgl.Marker({ element: createPinElement("user") })
          .setLngLat(userCenter)
          .addTo(map);

        fitToNeighborhood(map, userCenter);
        setLocationStatus("Centered within 3km of you");
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED ? "Location permission was blocked" : "Unable to get your location";

        console.warn("Unable to get current location:", error.message);
        setLocationStatus(message);
        fitToNeighborhood(map, INITIAL_CENTER);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 8_000,
      },
    );
  }, []);

  const openTopic = useCallback((topic: Topic, marker?: mapboxgl.Marker) => {
    const map = mapRef.current;

    setSelectedTopicId(topic.id);
    setSheetOpen(true);

    if (map) {
      map.flyTo({
        center: topic.lngLat,
        duration: 600,
        offset: [0, -120],
        zoom: Math.max(map.getZoom(), 15),
      });
    }

    const topicMarker = marker ?? topicMarkersRef.current.get(topic.id);
    const popup = topicMarker?.getPopup();

    if (topicMarker && popup && !popup.isOpen()) {
      topicMarker.togglePopup();
    }
  }, []);

  async function openTopicComposer() {
    const map = mapRef.current;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    setComposerOpen(true);
    setAddressStatus("");

    if (!map || !token) {
      return;
    }

    const center = map.getCenter();
    const fallbackAddress = `${formatCoord(center.lat)}, ${formatCoord(center.lng)}`;

    setDraftAddress(fallbackAddress);
    setAddressStatus("Finding current map address...");

    try {
      const address = await reverseGeocode([center.lng, center.lat], token);
      setDraftAddress(address);
      setAddressStatus("Address filled from current map center");
    } catch (error) {
      console.warn(error);
      setAddressStatus("Using map coordinates as the address");
    }
  }

  async function publishTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const map = mapRef.current;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!map || !draftTitle.trim() || !draftAddress.trim() || !draftContent.trim()) {
      return;
    }

    const center = map.getCenter();
    const fallbackLngLat: [number, number] = [center.lng, center.lat];
    let topicAddress = draftAddress.trim();
    let topicLngLat = fallbackLngLat;

    setPublishingTopic(true);

    if (token) {
      try {
        const geocoded = await geocodeAddress(topicAddress, fallbackLngLat, token);

        if (geocoded) {
          topicAddress = geocoded.address;
          topicLngLat = geocoded.lngLat;
        }
      } catch (error) {
        console.warn(error);
        setAddressStatus("Could not resolve address, using current map center");
      }
    }

    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: topicHeaders(),
        body: JSON.stringify({
          title: draftTitle.trim(),
          summary: draftContent.trim(),
          address: topicAddress,
          lngLat: topicLngLat,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to publish topic");
      }

      const data = (await response.json()) as { topic: Topic };
      const topic = {
        ...data.topic,
        isMine: true,
        posts: data.topic.posts.map((post, index) => ({ ...post, isMine: index === 0 ? true : post.isMine })),
      };

      setTopics((currentTopics) => [topic, ...currentTopics]);
      setDraftTitle("");
      setDraftAddress("");
      setDraftContent("");
      setAddressStatus("");
      setComposerOpen(false);
      setSelectedTopicId(topic.id);
      map.flyTo({ center: topic.lngLat, duration: 500, zoom: Math.max(map.getZoom(), 15) });
    } catch (error) {
      console.warn(error);
      setAddressStatus("Could not publish topic. Try again.");
    } finally {
      setPublishingTopic(false);
    }
  }

  async function addPostToTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTopic || !topicPostDraft.trim()) {
      return;
    }

    const response = await fetch(`/api/topics/${selectedTopic.id}/posts`, {
      method: "POST",
      headers: topicHeaders(),
      body: JSON.stringify({ content: topicPostDraft.trim() }),
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { post: ThreadPost };
    const post = { ...data.post, isMine: true };

    setTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === selectedTopic.id
          ? {
              ...topic,
              posts: [post, ...topic.posts],
            }
          : topic,
      ),
    );
    setTopicPostDraft("");
  }

  async function votePost(topicId: string, postId: string, delta: 1 | -1) {
    const previousTopics = topics;

    setTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === topicId
          ? {
              ...topic,
              posts: topic.posts.map((post) => (post.id === postId ? { ...post, votes: post.votes + delta } : post)),
            }
          : topic,
      ),
    );

    const response = await fetch(`/api/topics/${topicId}/posts/${postId}/vote`, {
      method: "POST",
      headers: topicHeaders(),
      body: JSON.stringify({ value: delta }),
    });

    if (!response.ok) {
      setTopics(previousTopics);
      return;
    }

    const data = (await response.json()) as { votes: number };

    setTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === topicId
          ? {
              ...topic,
              posts: topic.posts.map((post) => (post.id === postId ? { ...post, votes: data.votes } : post)),
            }
          : topic,
      ),
    );
  }

  async function deletePost(topicId: string, postId: string) {
    const previousTopics = topics;

    setTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === topicId ? { ...topic, posts: topic.posts.filter((post) => post.id !== postId) } : topic,
      ),
    );

    const response = await fetch(`/api/topics/${topicId}/posts/${postId}`, {
      method: "DELETE",
      headers: topicHeaders(),
    });

    if (!response.ok) {
      setTopics(previousTopics);
    }
  }

  async function addReply(topicId: string, postId: string) {
    const content = replyDrafts[postId]?.trim();

    if (!content) {
      return;
    }

    const response = await fetch(`/api/topics/${topicId}/posts/${postId}/replies`, {
      method: "POST",
      headers: topicHeaders(),
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { reply: Reply };
    const reply = { ...data.reply, isMine: true };

    setTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === topicId
          ? {
              ...topic,
              posts: topic.posts.map((post) =>
                post.id === postId ? { ...post, replies: [...post.replies, reply] } : post,
              ),
            }
          : topic,
      ),
    );
    setReplyDrafts((currentDrafts) => ({ ...currentDrafts, [postId]: "" }));
  }

  async function deleteReply(topicId: string, postId: string, replyId: string) {
    const previousTopics = topics;

    setTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === topicId
          ? {
              ...topic,
              posts: topic.posts.map((post) =>
                post.id === postId
                  ? {
                      ...post,
                      replies: post.replies.filter((reply) => reply.id !== replyId),
                    }
                  : post,
              ),
            }
          : topic,
      ),
    );

    const response = await fetch(`/api/topics/${topicId}/posts/${postId}/replies/${replyId}`, {
      method: "DELETE",
      headers: topicHeaders(),
    });

    if (!response.ok) {
      setTopics(previousTopics);
    }
  }

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!containerRef.current || mapRef.current) {
      return;
    }

    if (!token) {
      console.error("Missing NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN");
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      center: INITIAL_CENTER,
      container: containerRef.current,
      cooperativeGestures: true,
      pitchWithRotate: false,
      style: "mapbox://styles/mapbox/dark-v11",
      zoom: INITIAL_ZOOM,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      setMapReady(true);
      logCurrentBounds(map);
      fitToNeighborhood(map, INITIAL_CENTER);

      if (!navigator.permissions?.query) {
        return;
      }

      navigator.permissions
        .query({ name: "geolocation" })
        .then((permission) => {
          if (permission.state === "granted") {
            locateUser();
          }
        })
        .catch(() => {
          setLocationStatus("Use your location to center nearby");
        });
    });

    map.on("moveend", () => {
      logCurrentBounds(map);
    });

    const topicMarkers = topicMarkersRef.current;

    return () => {
      userMarkerRef.current?.remove();
      topicMarkers.forEach((marker) => marker.remove());
      topicMarkers.clear();
      userMarkerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [locateUser]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const activeIds = new Set(topics.map((topic) => topic.id));

    topicMarkersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        topicMarkersRef.current.delete(id);
      }
    });

    topics.forEach((topic) => {
      if (topicMarkersRef.current.has(topic.id)) {
        return;
      }

      const marker = new mapboxgl.Marker({ element: createPinElement(topic.isMine ? "mine" : "nearby") })
        .setLngLat(topic.lngLat)
        .setPopup(
          new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: false,
            offset: 36,
          }).setHTML(topicPopupHtml(topic)),
        )
        .addTo(map);

      marker.getElement().addEventListener("click", (event) => {
        event.stopPropagation();
        openTopic(topic, marker);
      });

      topicMarkersRef.current.set(topic.id, marker);
    });
  }, [mapReady, openTopic, topics]);

  return (
    <section className="h-[calc(100vh-73px)] min-h-[520px] bg-zinc-950">
      <div className="relative h-full w-full overflow-hidden">
        <div ref={containerRef} className="h-full w-full" />
        <div className="absolute left-4 top-4 max-w-[calc(100%-2rem)] rounded-lg bg-white/95 px-4 py-3 text-sm text-zinc-900 shadow-lg">
          <div className="mb-3 font-semibold">Sydney nightlife map</div>
          <button
            className="flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            onClick={locateUser}
            type="button"
          >
            <LocateFixed aria-hidden="true" size={16} />
            Use my location
          </button>
          <div className="mt-2 max-w-56 text-xs leading-5 text-zinc-600">{locationStatus}</div>
        </div>

        <aside
          className={`absolute inset-x-0 bottom-0 z-10 rounded-t-2xl border border-white/15 bg-zinc-950/95 text-white shadow-2xl backdrop-blur transition-transform duration-300 ${
            sheetOpen ? "translate-y-0" : "translate-y-[calc(100%-72px)]"
          }`}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
            <button
              aria-label={sheetOpen ? "Collapse topics panel" : "Expand topics panel"}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              onClick={() => setSheetOpen((open) => !open)}
              type="button"
            >
              {sheetOpen ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Nearby topics</div>
              <div className="text-xs text-zinc-400">
                {topics.length} local discussions on the map · {topicsStatus}
              </div>
            </div>
            <button
              className="flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
              onClick={openTopicComposer}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              Topic
            </button>
          </div>

          <div className="mx-auto max-w-6xl px-4 pb-5 md:px-6">
            <div className="flex snap-x gap-3 overflow-x-auto pb-3">
              {topics.map((topic) => (
                <button
                  className="min-w-[280px] snap-start rounded-lg border border-white/10 bg-white p-4 text-left text-zinc-950 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                  key={topic.id}
                  onClick={() => openTopic(topic)}
                  type="button"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        topic.isMine ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {topic.isMine ? "Your topic" : "Nearby"}
                    </span>
                    <span className="text-xs text-zinc-500">{topic.createdAt}</span>
                  </div>
                  <div className="line-clamp-1 font-semibold">{topic.title}</div>
                  <p className="mt-2 line-clamp-2 text-sm leading-5 text-zinc-600">{topic.summary}</p>
                  <div className="mt-3 line-clamp-1 text-xs font-medium text-zinc-500">{topic.address}</div>
                  <div className="mt-1 text-xs font-medium text-zinc-500">{topic.posts.length} posts</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {selectedTopic ? (
          <div className="absolute inset-0 z-20 overflow-y-auto bg-zinc-950/96 text-white backdrop-blur">
            <div className="mx-auto max-w-5xl px-4 py-5 md:px-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-300">Topic</div>
                  <h1 className="text-2xl font-bold md:text-3xl">{selectedTopic.title}</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">{selectedTopic.summary}</p>
                  <div className="mt-3 text-xs text-zinc-500">
                    {selectedTopic.address} · {selectedTopic.posts.length} posts · pinned {selectedTopic.createdAt}
                  </div>
                </div>
                <button
                  aria-label="Close topic"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                  onClick={() => setSelectedTopicId(null)}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>

              <form className="mb-5 rounded-lg border border-white/10 bg-white p-4 text-zinc-950" onSubmit={addPostToTopic}>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Add a post to this topic</span>
                  <textarea
                    className="min-h-24 w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                    onChange={(event) => setTopicPostDraft(event.target.value)}
                    placeholder="Share an update, question, or useful detail."
                    value={topicPostDraft}
                  />
                </label>
                <button
                  className="mt-3 flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  disabled={!topicPostDraft.trim()}
                  type="submit"
                >
                  <Send aria-hidden="true" size={16} />
                  Post reply
                </button>
              </form>

              <div className="grid gap-4">
                {selectedTopic.posts.map((post) => (
                  <article className="rounded-lg border border-white/10 bg-white p-4 text-zinc-950 shadow-xl" key={post.id}>
                    <div className="flex gap-4">
                      <div className="flex w-10 shrink-0 flex-col items-center gap-1 text-zinc-500">
                        <button
                          aria-label="Upvote post"
                          className="rounded-md p-1 transition hover:bg-zinc-100 hover:text-rose-600"
                          onClick={() => votePost(selectedTopic.id, post.id, 1)}
                          type="button"
                        >
                          <ThumbsUp size={16} />
                        </button>
                        <div className="text-sm font-bold text-zinc-900">{post.votes}</div>
                        <button
                          aria-label="Downvote post"
                          className="rounded-md p-1 transition hover:bg-zinc-100 hover:text-zinc-900"
                          onClick={() => votePost(selectedTopic.id, post.id, -1)}
                          type="button"
                        >
                          <ThumbsDown size={16} />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs text-zinc-500">
                            posted by <span className="font-semibold text-zinc-800">{post.author}</span> · {post.createdAt}
                          </div>
                          {post.isMine ? (
                            <button
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
                              onClick={() => deletePost(selectedTopic.id, post.id)}
                              type="button"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          ) : null}
                        </div>
                        <p className="text-sm leading-6 text-zinc-800">{post.content}</p>

                        <div className="mt-4 border-t border-zinc-200 pt-3">
                          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-500">
                            <MessageCircle size={14} />
                            {post.replies.length} replies
                          </div>
                          <div className="grid gap-2">
                            {post.replies.map((reply) => (
                              <div className="rounded-md bg-zinc-50 px-3 py-2" key={reply.id}>
                                <div className="mb-1 flex items-center justify-between gap-3">
                                  <div className="text-xs text-zinc-500">
                                    <span className="font-semibold text-zinc-800">{reply.author}</span> · {reply.createdAt}
                                  </div>
                                  {reply.isMine ? (
                                    <button
                                      className="text-xs font-medium text-zinc-500 transition hover:text-red-600"
                                      onClick={() => deleteReply(selectedTopic.id, post.id, reply.id)}
                                      type="button"
                                    >
                                      Delete
                                    </button>
                                  ) : null}
                                </div>
                                <p className="text-sm leading-5 text-zinc-700">{reply.content}</p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <input
                              className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                              onChange={(event) =>
                                setReplyDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [post.id]: event.target.value,
                                }))
                              }
                              placeholder="Write a reply"
                              value={replyDrafts[post.id] ?? ""}
                            />
                            <button
                              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                              disabled={!replyDrafts[post.id]?.trim()}
                              onClick={() => addReply(selectedTopic.id, post.id)}
                              type="button"
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {composerOpen ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 px-4 backdrop-blur-sm">
            <form className="w-full max-w-md rounded-xl bg-white p-5 text-zinc-950 shadow-2xl" onSubmit={publishTopic}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Create a topic</h2>
                  <p className="mt-1 text-sm text-zinc-500">Address starts from the current map center</p>
                </div>
                <button
                  aria-label="Close composer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200"
                  onClick={() => setComposerOpen(false)}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>

              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">Topic title</span>
                <input
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="What should people discuss here?"
                  value={draftTitle}
                />
              </label>

              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">Address</span>
                <input
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  onChange={(event) => {
                    setDraftAddress(event.target.value);
                    setAddressStatus("Address edited manually");
                  }}
                  placeholder="Venue, street address, or neighborhood"
                  value={draftAddress}
                />
                {addressStatus ? <span className="mt-1 block text-xs text-zinc-500">{addressStatus}</span> : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">First post</span>
                <textarea
                  className="min-h-32 w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  onChange={(event) => setDraftContent(event.target.value)}
                  placeholder="Start the thread with context, a question, or an update."
                  value={draftContent}
                />
              </label>

              <button
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                disabled={publishingTopic || !draftTitle.trim() || !draftAddress.trim() || !draftContent.trim()}
                type="submit"
              >
                <Send aria-hidden="true" size={16} />
                {publishingTopic ? "Publishing..." : "Publish topic"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}
