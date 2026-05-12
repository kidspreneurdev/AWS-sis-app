alter table students
  alter column grade type text
  using (
    case
      when grade is null then null
      when grade = -1 then 'Pre-K'
      when grade = 0 then 'K'
      else grade::text
    end
  );

alter table students
  alter column grade_when_joined type text
  using (
    case
      when grade_when_joined is null then null
      when grade_when_joined = -1 then 'Pre-K'
      when grade_when_joined = 0 then 'K'
      else grade_when_joined::text
    end
  );
