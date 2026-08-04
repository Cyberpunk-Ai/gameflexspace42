export function pageSeo({ title, description }: { title?: string; description?: string } = {}) {
  return {
    meta: [
      { title: title ? `${title} | GameFlex` : "GameFlex" },
      {
        name: "description",
        content:
          description ||
          "Compete in FIFA, Mobile Legends, and Call of Duty tournaments to win cash prizes.",
      },
    ],
  };
}
