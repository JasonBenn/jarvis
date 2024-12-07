import axios from "axios";
import SpotifyWebApi from "spotify-web-api-node";

export const callTool = async (name: string, args: Record<string, any>) => {
  switch (name) {
    case "write_note":
      return await writeNote(
        args.title,
        args.content,
        args.filename,
        args.date
      );
    case "get_goals":
      return await getGoals(args.periods);
    case "create_card":
      return await createCard(args.front, args.back, args.deck);
    case "get_card":
      return await getCard(args.card_id);
    case "update_card":
      return await updateCard(args.card_id, args.front, args.back);
    case "delete_card":
      return await deleteCard(args.card_id);
    case "create_spotify_radio":
      return await createSpotifyRadio(args.artistName);
    case "get_comedy_events":
      return await getComedyEvents();
  }
  throw new Error(`Unknown tool: ${name}`);
};

const writeNote = async (
  title: string,
  content: string,
  filename?: string,
  date?: string
) => {
  const response = await axios.post(
    "https://tutor.mleclub.com/api/append-log",
    {
      title,
      content,
      filename,
      date,
    }
  );
  return response.data;
};

const getGoals = async (periods: string[]) => {
  const response = await axios.post("https://tutor.mleclub.com/api/goals", {
    periods,
  });
  return response.data;
};

const createCard = async (front: string, back: string, deck: string) => {
  const response = await axios.post("https://tutor.mleclub.com/api/cards", {
    front,
    back,
    deck,
  });
  return response.data;
};

const getCard = async (cardId: string) => {
  const response = await axios.get(
    `https://tutor.mleclub.com/api/card?card_id=${cardId}`
  );
  return response.data;
};

const updateCard = async (cardId: string, front: string, back: string) => {
  const response = await axios.put("https://tutor.mleclub.com/api/card", {
    card_id: cardId,
    front,
    back,
  });
  return response.data;
};

const deleteCard = async (cardId: string) => {
  const response = await axios.post(
    "https://tutor.mleclub.com/api/card/delete",
    {
      card_id: cardId,
    }
  );
  return response.data;
};

const createSpotifyRadio = async (artistName: string) => {
  const spotify = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
  });

  // Search for the artist
  const artistResults = await spotify.searchArtists(artistName);
  if (!artistResults.body.artists?.items.length) {
    throw new Error(`Could not find artist: ${artistName}`);
  }

  const artistId = artistResults.body.artists.items[0].id;

  // Get recommendations based on the artist
  const recommendations = await spotify.getRecommendations({
    seed_artists: [artistId],
    limit: 20,
  });

  // create a playlist
  const playlist = await spotify.createPlaylist(artistName, {
    public: false,
  });
  const playlistId = playlist.body.id;

  // add the recommendations to the playlist
  await spotify.addTracksToPlaylist(
    playlistId,
    recommendations.body.tracks.map((track) => track.id)
  );

  // Get the user's available devices
  const devices = await spotify.getMyDevices();
  const activeDevice = devices.body.devices.find((device) => device.is_active);

  if (!activeDevice) {
    throw new Error(
      "No active Spotify device found. Please open Spotify first."
    );
  }

  // Start playback on the active device
  await spotify.play({
    device_id: activeDevice.id!,
    context_uri: `spotify:playlist:${playlistId}`,
  });
};

const getComedyEvents = async () => {
  const response = await axios.get("https://tutor.mleclub.com/api/comedy");
  return response.data;
};

const noteTools = [
  {
    name: "write_note",
    type: "function",
    description:
      'An external API that appends a brief personal note to an existing document, usually just a couple paragraphs or less of thoughts. The content should be lightly cleaned up by removing "um" etc, but otherwise don\'t editorialize at all. Also generate a concise title for the note - just an evocative phrase or two that captures the essence of the note.',
    parameters: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "The filename to append to.",
        },
        content: {
          type: "string",
          description: "The content of the note",
        },
        title: {
          type: "string",
          description:
            "A concise title - half a sentence or so - that briefly describes the most salient part of the note. Use lowercase except for proper nouns.",
        },
        date: {
          type: "string",
          description:
            "Optional date for the note in YYYY-MM-DD format. Only use this if the description specifies a date other than today. This might be approximate or relative - just choose a date that approximately captures the spirit of the request.",
        },
      },
      required: ["title", "content"],
    },
  },
];

const spotifyTools = [
  {
    name: "create_spotify_radio",
    type: "function",
    description:
      "Creates a radio station based on a given artist using Spotify's recommendation engine",
    parameters: {
      type: "object",
      properties: {
        artistName: {
          type: "string",
          description: "The name of the artist to base recommendations on",
        },
      },
      required: ["artistName"],
    },
  },
];

const goalTools = [
  {
    name: "get_goals",
    type: "function",
    description:
      "Retrieve periodic goals for specified time periods (day, week, month, quarter, year). For planning a typical day, prefer a combination of daily and weekly goals.",
    parameters: {
      type: "object",
      properties: {
        periods: {
          type: "array",
          items: {
            type: "string",
            enum: ["day", "week", "month", "quarter", "year"],
          },
          description: "Array of goals by time period",
        },
      },
      required: ["periods"],
    },
  },
];

const mochiTools = [
  {
    name: "create_card",
    type: "function",
    description:
      "Creates a flashcard in Mochi with specified front and back content. Use LaTeX for mathematical expressions: inline with single $ and block with $$.",
    parameters: {
      type: "object",
      properties: {
        front: {
          type: "string",
          description: "The markdown content for the front of the card",
        },
        back: {
          type: "string",
          description: "The markdown content for the back of the card",
        },
        deck: {
          type: "string",
          enum: [
            "MACHINE_LEARNING",
            "DISTRIBUTED_SYSTEMS",
            "OPERATING_SYSTEMS",
            "SYSTEM_DESIGN",
            "PYTHON",
            "JAVASCRIPT",
            "NETWORKING",
            "ARCHITECTURE",
            "DATABASES",
            "PYTORCH",
          ],
          description: "The deck where the card should be created",
        },
      },
      required: ["front", "back", "deck"],
    },
  },
  {
    name: "get_card",
    type: "function",
    description: "Retrieves a specific flashcard from Mochi by its ID",
    parameters: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "The unique identifier of the card to retrieve",
        },
      },
      required: ["card_id"],
    },
  },
  {
    name: "update_card",
    type: "function",
    description: "Updates an existing flashcard in Mochi",
    parameters: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "The unique identifier of the card to update",
        },
        front: {
          type: "string",
          description: "The updated markdown content for the front of the card",
        },
        back: {
          type: "string",
          description: "The updated markdown content for the back of the card",
        },
      },
      required: ["card_id", "front", "back"],
    },
  },
  {
    name: "delete_card",
    type: "function",
    description: "Deletes a flashcard from Mochi",
    parameters: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "The unique identifier of the card to delete",
        },
      },
      required: ["card_id"],
    },
  },
];

const comedyTools = [
  {
    name: "get_comedy_events",
    type: "function",
    description:
      "Retrieves local comedy events including open mics, major shows, and small shows in the area",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

export const getTools = () => {
  // return [...noteTools, ...spotifyTools, ...mochiTools, ...goalTools, ...comedyTools];
  return [...noteTools, ...goalTools, ...comedyTools];
};
