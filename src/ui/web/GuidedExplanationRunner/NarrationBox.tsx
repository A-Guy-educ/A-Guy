interface NarrationBoxProps {
  text: string
}

export function NarrationBox({ text }: NarrationBoxProps) {
  return (
    <div className="ge-narration-box">
      <span className="ge-narration-text">{text}</span>
    </div>
  )
}
