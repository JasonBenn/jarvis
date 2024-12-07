import axios from "axios";

export const writeNote = async (
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

export const getTools = () => {
  return [
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
};
