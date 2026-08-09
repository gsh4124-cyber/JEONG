type ReviewGratitudeProps = {
  morningValues: string[];
  eveningValues: string[];
  onMorningChange: (index: number, value: string) => void;
  onEveningChange: (index: number, value: string) => void;
};

type GratitudeColumnProps = {
  title: string;
  values: string[];
  onChange: (index: number, value: string) => void;
};

function GratitudeColumn({ title, values, onChange }: GratitudeColumnProps) {
  return (
    <section className="reviewGratitudeV2Column">
      <h3>{title}</h3>
      <div className="reviewGratitudeV2Entries">
        {[0, 1, 2].map((index) => (
          <label className="reviewGratitudeV2Row" key={index}>
            <b>{index + 1}.</b>
            <textarea
              className="reviewGratitudeV2Textarea"
              rows={2}
              value={values[index] ?? ""}
              onChange={(event) => onChange(index, event.target.value)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

export function ReviewGratitude({
  morningValues,
  eveningValues,
  onMorningChange,
  onEveningChange,
}: ReviewGratitudeProps) {
  return (
    <section className="reviewGratitudeV2">
      <strong>감사 기록</strong>
      <small>아침과 저녁에 각각 세 가지씩 기록합니다.</small>
      <div className="reviewGratitudeV2Columns">
        <GratitudeColumn
          title="🌿 아침 감사 3가지"
          values={morningValues}
          onChange={onMorningChange}
        />
        <GratitudeColumn
          title="🌙 저녁 감사 3가지"
          values={eveningValues}
          onChange={onEveningChange}
        />
      </div>
    </section>
  );
}
