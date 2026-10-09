-- 023_content_single_body.sql : 콘텐츠 페이지의 소탭(content_sections)을 없애고 페이지마다 본문 하나 (content_pages.body, 마크다운)
-- 소탭이 1개였던 페이지는 그 내용 그대로, 여러 개였던 페이지는 "## 소탭 제목" + 내용으로 순서대로 이어 붙임 (내용은 잃지 않음)
SET SESSION group_concat_max_len = 16777216;

UPDATE content_pages p
  JOIN (
    SELECT page_slug,
           COUNT(*) AS n,
           GROUP_CONCAT(COALESCE(body, '') ORDER BY sort_order, id SEPARATOR '\n\n') AS only_body,
           GROUP_CONCAT(CONCAT('## ', title, '\n\n', COALESCE(body, '')) ORDER BY sort_order, id SEPARATOR '\n\n') AS merged
      FROM content_sections
     GROUP BY page_slug
  ) s ON s.page_slug = p.slug
   SET p.body = IF(s.n = 1, s.only_body, s.merged);

DROP TABLE content_sections;
