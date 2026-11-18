// 社区连接初始化。
// 浏览时不自动建立匿名身份，发帖或评论时再登录。
(function setupCommunityConnection() {
  const config = window.PAWVIEW_COMMUNITY_CONFIG;

  if (
    !config ||
    !config.url.startsWith("https://") ||
    config.publishableKey.includes("这里填写")
  ) {
    console.error("社区配置尚未填写完成。");
    return;
  }

  if (!window.supabase?.createClient) {
    console.error("社区组件加载失败，请检查网络后刷新。");
    return;
  }

  const client = window.supabase.createClient(
    config.url,
    config.publishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "pawview.community.auth.v1"
      }
    }
  );

  window.PawCommunity = {
    client,

    // 只读取公开帖子，检查连接和读取权限。
    async checkConnection() {
      const { error } = await client
        .from("community_posts")
        .select("id")
        .limit(1);

      if (error) {
        console.error("社区连接检查失败：", error.message);
        return false;
      }

      console.log("PawView 社区连接成功。");
      return true;
    }
  };

  window.PawCommunity.checkConnection();
})();
// 公开帖子列表：不要求登录，也不自动创建匿名账号。
document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("communityPostList");
  const status = document.getElementById("communityListStatus");
  const refresh = document.getElementById("communityRefreshButton");
  const page = document.getElementById("page-community");

  if (!list || !status || !refresh || !page) return;

  const categories = {
    daily: "일상",
    food: "식사",
    training: "훈련",
    question: "질문"
  };
// 帖子分类筛选。
const categoryFilter = document.createElement("select");
categoryFilter.id = "communityCategoryFilter";
categoryFilter.setAttribute("aria-label", "게시글 분류");

const filterOptions = [
  ["all", "전체"],
  ["daily", "일상"],
  ["food", "식사"],
  ["training", "훈련"],
  ["question", "질문"]
];

for (const [value, label] of filterOptions) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  categoryFilter.appendChild(option);
}

const filterLabel = document.createElement("label");
filterLabel.htmlFor = "communityCategoryFilter";
filterLabel.textContent = "게시글 분류 ";
filterLabel.appendChild(categoryFilter);

list.before(filterLabel);

  let loading = false;
const pageSize = 20;
let nextCursor = null;
let hasMore = false;

const moreButton = document.createElement("button");
moreButton.id = "communityLoadMoreButton";
moreButton.type = "button";
moreButton.className = "secondary-button";
moreButton.textContent = "더 보기";
moreButton.hidden = true;
moreButton.style.marginTop = "16px";

list.after(moreButton);

  async function loadCommunityPosts(append = false) {
  // 点击事件会传入 Event 对象，只有明确传 true 才追加。
  append = append === true;

  if (append && !hasMore) return;

    if (loading) return;

    const client = window.PawCommunity?.client;

    if (!client) {
      status.textContent =
        "커뮤니티 연결을 확인한 뒤 페이지를 새로고침해 주세요.";
      return;
    }

   loading = true;
refresh.disabled = true;
categoryFilter.disabled = true;
moreButton.disabled = true;

    status.textContent = "게시글을 불러오는 중…";

    try {
      let query = client
  .from("community_posts")
  .select(
    "id, author_id, category, title, content, created_at, author:community_profiles(nickname)"
  );

if (categoryFilter.value !== "all") {
  query = query.eq("category", categoryFilter.value);
}

// 分类条件已经在前面加入，继续保留。
if (append && nextCursor) {
  query = query.or(
    `created_at.lt.${nextCursor.created_at},` +
    `and(created_at.eq.${nextCursor.created_at},id.lt.${nextCursor.id})`
  );
}

const { data, error } = await query
  .order("created_at", { ascending: false })
  .order("id", { ascending: false })
  .limit(pageSize);


      if (error) throw error;
// 只读取已有身份，不自动创建账号。
const { data: sessionData, error: sessionError } =
  await client.auth.getSession();

if (sessionError) throw sessionError;

const currentUserId = sessionData.session?.user?.id || null;
const blockState = await window.PawCommunity.getBlockState();

      const fragment = document.createDocumentFragment();

      for (const post of data || []) {
        if (blockState.blockedIds.has(post.author_id)) continue;

        const item = document.createElement("article");
        item.className = "community-post-item";
item.dataset.postId = post.id;

        const meta = document.createElement("p");
        meta.className = "community-post-meta";

        const date = new Date(post.created_at);
        meta.textContent =
  (post.author?.nickname || "닉네임 없음") +
  " · " +
  (categories[post.category] || "기타") +
  " · " +
  date.toLocaleString("ko-KR");


        const title = document.createElement("h3");
        title.textContent = post.title;

        const preview = document.createElement("p");
        preview.className = "community-post-preview";
        preview.textContent =
          post.content.length > 160
            ? post.content.slice(0, 160) + "…"
            : post.content;

        item.append(meta, title, preview);
const detailButton = document.createElement("button");
detailButton.type = "button";
detailButton.className = "secondary-button community-detail-button";
detailButton.textContent = "전체 글 및 댓글";

detailButton.addEventListener("click", () => {
  document.dispatchEvent(
    new CustomEvent("pawview:community-open-post", {
      detail: { postId: post.id }
    })
  );
});

item.appendChild(detailButton);
if (currentUserId && post.author_id !== currentUserId) {
  item.appendChild(
    window.PawCommunity.createBlockButton(
      post.author_id,
      post.author?.nickname
    )
  );
}

const postReportButton =
  window.PawCommunity?.createReportButton?.("post", post.id);

if (postReportButton) {
  item.appendChild(postReportButton);
}

// 只在自己的帖子上显示删除按钮。
// 实际删除权限仍由服务器 RLS 校验。
if (currentUserId && post.author_id === currentUserId) {
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "community-delete-button";
  deleteButton.textContent = "내 글 삭제";

  deleteButton.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "이 게시글을 삭제할까요? 연결된 댓글도 삭제되며 복구할 수 없습니다."
    );

    if (!confirmed) return;

    deleteButton.disabled = true;
    deleteButton.textContent = "삭제 중…";

    try {
      const { data: deleted, error: deleteError } = await client
        .from("community_posts")
        .delete()
        .eq("id", post.id)
        .eq("author_id", currentUserId)
        .select("id");

      if (deleteError) throw deleteError;

      if (!deleted || deleted.length !== 1) {
        throw new Error("Post not deleted or permission unavailable");
      }

      item.remove();

document.dispatchEvent(
  new CustomEvent("pawview:community-post-deleted", {
    detail: { postId: post.id }
  })
);

status.textContent = "게시글을 삭제했습니다.";


      // 重新读取列表，更新数量和空状态。
      await loadCommunityPosts();
    } catch (error) {
      console.error("社区帖子删除失败：", error);

      status.textContent =
        "삭제 완료를 확인하지 못했습니다. 목록을 새로고침해 확인해 주세요.";

      deleteButton.disabled = false;
      deleteButton.textContent = "내 글 삭제";
    }
  });

  item.appendChild(deleteButton);
}

fragment.appendChild(item);

      }

          if (append) {
        list.appendChild(fragment);
      } else {
        list.replaceChildren(fragment);
      }

      // 使用服务器返回的最后一条推进游标，
      // 即使该条被屏蔽，也不能停在旧位置。
      const lastPost = data?.[data.length - 1];

      nextCursor = lastPost
        ? {
            created_at: lastPost.created_at,
            id: lastPost.id
          }
        : null;

      // 正好20条时，允许再查一次；
      // 下一页为空后才确定没有更多。
      hasMore = (data?.length || 0) === pageSize;

      const shownCount = list.children.length;

      status.textContent = shownCount
        ? `표시 중 ${shownCount}개 · 차단한 작성자 제외` +
          (hasMore ? "" : " · 마지막 게시글입니다.")
        : hasMore
          ? "현재 조회 구간에 표시할 글이 없습니다. 더 보기로 다음 글을 확인하세요."
          : "표시할 게시글이 없습니다.";
    } catch (error) {
      console.error("社区帖子读取失败：", error);

      // 请求失败不清除已显示的帖子，也不推进游标。
      status.textContent =
        "불러오지 못했습니다. 기존 목록은 유지했습니다. " +
        "새로고침 또는 더 보기로 다시 시도해 주세요.";
    } finally {
      loading = false;
      refresh.disabled = false;
      categoryFilter.disabled = false;
      moreButton.disabled = false;
      moreButton.hidden = !hasMore;
    }

  }

  refresh.addEventListener("click", loadCommunityPosts);
  moreButton.addEventListener("click", () => {
  loadCommunityPosts(true);
});

  categoryFilter.addEventListener("change", loadCommunityPosts);

document.addEventListener(
  "pawview:community-blocks-updated",
  () => {
    if (loading) {
      // 旧查询结束后再刷新，避免跳过本次更新。
      refreshBlocksWhenReady();
    } else {
      loadCommunityPosts();
    }
  }
);

function refreshBlocksWhenReady() {
  if (loading) {
    setTimeout(refreshBlocksWhenReady, 100);
    return;
  }
  loadCommunityPosts();
}

  const observer = new MutationObserver(() => {
    if (page.classList.contains("active")) {
      loadCommunityPosts();
    }
  });

  observer.observe(page, {
    attributes: true,
    attributeFilter: ["class"]
  });

  if (page.classList.contains("active")) {
    loadCommunityPosts();
  }
});
// 社区昵称：用户主动保存时才建立匿名身份。
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("communityNicknameForm");
  const input = document.getElementById("communityNickname");
  const button = document.getElementById("communityNicknameSave");
  const status = document.getElementById("communityProfileStatus");

  if (!form || !input || !button || !status) return;

  const client = window.PawCommunity?.client;

  if (!client) {
    button.disabled = true;
    status.textContent =
      "커뮤니티 연결을 확인한 뒤 페이지를 새로고침해 주세요.";
    return;
  }

  let busy = false;

  // 只检查已有会话，不自动创建匿名账号。
  async function loadExistingProfile() {
    busy = true;
    button.disabled = true;

    try {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      const session = sessionData.session;

      if (!session) {
        status.textContent =
          "닉네임을 설정하면 글과 댓글을 작성할 수 있습니다.";
        return;
      }

      const { data: profile, error } = await client
        .from("community_profiles")
        .select("nickname")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) throw error;

      if (profile) {
        input.value = profile.nickname;
        status.textContent =
          `현재 닉네임: ${profile.nickname}`;
      } else {
        status.textContent =
          "익명 신분이 준비되었습니다. 닉네임을 저장해 주세요.";
      }
    } catch (error) {
      console.error("社区昵称读取失败：", error);
      status.textContent =
        "프로필을 불러오지 못했습니다. 연결 상태를 확인해 주세요.";
    } finally {
      busy = false;
      button.disabled = false;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (busy) return;

    const nickname = input.value.trim();
    const length = Array.from(nickname).length;

    if (length < 2 || length > 20) {
      status.textContent = "닉네임은 2~20자로 입력해 주세요.";
      return;
    }

    busy = true;
    button.disabled = true;
    status.textContent = "닉네임을 저장하는 중…";

    try {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      let user = sessionData.session?.user;

      if (!user) {
        const { data, error } =
          await client.auth.signInAnonymously();

        if (error) throw error;

        user = data.user;
      }

      if (!user) {
        throw new Error("Anonymous identity unavailable");
      }

      const { data: existing, error: readError } = await client
        .from("community_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (readError) throw readError;

      if (existing) {
        const { data: updated, error } = await client
          .from("community_profiles")
          .update({ nickname })
          .eq("user_id", user.id)
          .select("nickname")
          .single();

        if (error) throw error;

        input.value = updated.nickname;
      } else {
        const { data: created, error } = await client
          .from("community_profiles")
          .insert({
            user_id: user.id,
            nickname
          })
          .select("nickname")
          .single();

        if (error) throw error;

        input.value = created.nickname;
      }

      status.textContent =
        `닉네임 저장 완료: ${input.value}`;

      document.dispatchEvent(
        new CustomEvent("pawview:community-profile-updated")
      );
      document.getElementById("communityRefreshButton")?.click();

    } catch (error) {
      console.error("社区昵称保存失败：", error);
      status.textContent =
        "저장하지 못했습니다. 네트워크와 익명 로그인 설정을 확인해 주세요.";
    } finally {
      busy = false;
      button.disabled = false;
    }
  });

  loadExistingProfile();
});
// 真实发帖：必须已有身份和昵称，不在提交时偷偷创建账号。
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("communityPostForm");
  const category = document.getElementById("communityPostCategory");
  const title = document.getElementById("communityPostTitle");
  const content = document.getElementById("communityPostContent");
  const button = document.getElementById("communityPostSubmit");
  const status = document.getElementById("communityPostStatus");

  if (!form || !category || !title || !content || !button || !status) {
    return;
  }

  let submitting = false;

  form.addEventListener("submit", async event => {
    event.preventDefault();

  if (submitting) return;

const consent = document.getElementById(
  "communityPostConsent"
);

if (!consent?.checked) {
  status.textContent = "이용 안내와 공개 게시 확인란을 체크해 주세요.";
  return;
}

const client = window.PawCommunity?.client;


    if (!client) {
      status.textContent = "커뮤니티 연결을 확인해 주세요.";
      return;
    }

    // 提交开始时固定本次内容。
    const post = {
      category: category.value,
      title: title.value.trim(),
      content: content.value.trim()
    };

    if (
      !["daily", "food", "training", "question"].includes(post.category) ||
      Array.from(post.title).length < 1 ||
      Array.from(post.title).length > 80 ||
      Array.from(post.content).length < 1 ||
      Array.from(post.content).length > 3000
    ) {
      status.textContent =
        "제목은 1~80자, 내용은 1~3000자로 입력해 주세요.";
      return;
    }

    submitting = true;
    button.disabled = true;

    // 发布过程中不允许继续编辑，避免成功后清掉新写的内容。
    category.disabled = true;
    title.disabled = true;
    content.disabled = true;
    status.textContent = "게시하는 중…";

    try {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      const user = sessionData.session?.user;

      if (!user) {
        status.textContent = "위에서 닉네임을 먼저 저장해 주세요.";
        return;
      }

      const { data: profile, error: profileError } = await client
        .from("community_profiles")
        .select("nickname")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        status.textContent = "위에서 닉네임을 먼저 저장해 주세요.";
        return;
      }

      const { error } = await client
        .from("community_posts")
        .insert({
          author_id: user.id,
          category: post.category,
          title: post.title,
          content: post.content
        });

      if (error) throw error;

      form.reset();
      status.textContent = "게시되었습니다.";

      // 调用现有列表刷新，不重复实现读取逻辑。
      document.getElementById("communityRefreshButton")?.click();
    } catch (error) {
      console.error("社区发帖失败：", error);
      if (error.message === "COMMUNITY_USER_RESTRICTED") {
  status.textContent =
    "현재 이 신분은 글과 댓글을 작성할 수 없습니다. 입력 내용은 유지했습니다.";
  return;
}

      if (error.message === "COMMUNITY_POST_RATE_LIMIT") {
  status.textContent =
    "게시글은 60초 간격으로 작성해 주세요. 입력 내용은 유지했습니다.";
  return;
}

      status.textContent =
        "게시 완료를 확인하지 못했습니다. 입력 내용은 유지했습니다. " +
        "다시 게시하기 전에 목록을 새로고침해 중복 여부를 확인해 주세요.";
    } finally {
      submitting = false;
      button.disabled = false;
      category.disabled = false;
      title.disabled = false;
      content.disabled = false;
    }
  });
});
// 帖子详情及评论。
document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("communityPostDetail");
  const title = document.getElementById("communityDetailTitle");
  const meta = document.getElementById("communityDetailMeta");
  const content = document.getElementById("communityDetailContent");
  const close = document.getElementById("communityDetailClose");
  const list = document.getElementById("communityCommentList");
  const status = document.getElementById("communityCommentStatus");
  const form = document.getElementById("communityCommentForm");
  const input = document.getElementById("communityCommentInput");
  const submit = document.getElementById("communityCommentSubmit");

  if (
    !panel || !title || !meta || !content || !close ||
    !list || !status || !form || !input || !submit
  ) return;

  const client = window.PawCommunity?.client;
  if (!client) return;

  let activePostId = null;
  let requestVersion = 0;
  let submitting = false;

  function closeDetail() {
    activePostId = null;
    requestVersion += 1;
    panel.hidden = true;
    list.replaceChildren();
    content.textContent = "";
    input.value = "";
  }

  close.addEventListener("click", closeDetail);
  document.addEventListener(
  "pawview:community-post-deleted",
  event => {
    if (event.detail?.postId === activePostId) {
      closeDetail();
    }
  }
);

  document.addEventListener(
  "pawview:community-blocks-updated",
  closeDetail
);

async function loadComments(postId, version) {
  const { data, error } = await client
    .from("community_comments")
    .select(
      "id, author_id, content, created_at, author:community_profiles(nickname)"
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);

  if (
    version !== requestVersion ||
    postId !== activePostId
  ) return;

  if (error) throw error;

  // 只读取当前身份，不自动创建账号。
  const { data: sessionData, error: sessionError } =
    await client.auth.getSession();

  if (
    version !== requestVersion ||
    postId !== activePostId
  ) return;

  if (sessionError) throw sessionError;

  const currentUserId = sessionData.session?.user?.id || null;
const blockState = await window.PawCommunity.getBlockState();

if (
  version !== requestVersion ||
  postId !== activePostId
) return;

const fragment = document.createDocumentFragment();

for (const comment of data || []) {
  if (blockState.blockedIds.has(comment.author_id)) continue;


    const item = document.createElement("article");
    item.className = "community-comment-item";

    const time = document.createElement("p");
    time.className = "community-post-meta";

    time.textContent =
      (comment.author?.nickname || "닉네임 없음") +
      " · " +
      new Date(comment.created_at).toLocaleString("ko-KR");

    const text = document.createElement("p");
    text.className = "community-comment-content";
    text.textContent = comment.content;

    item.append(time, text);
    if (currentUserId && comment.author_id !== currentUserId) {
  item.appendChild(
    window.PawCommunity.createBlockButton(
      comment.author_id,
      comment.author?.nickname
    )
  );
}

const commentReportButton =
  window.PawCommunity?.createReportButton?.(
    "comment",
    comment.id
  );

if (commentReportButton) {
  item.appendChild(commentReportButton);
}

    if (
      currentUserId &&
      comment.author_id === currentUserId
    ) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "community-delete-button";
      deleteButton.textContent = "내 댓글 삭제";

      deleteButton.addEventListener("click", async () => {
        if (
          version !== requestVersion ||
          postId !== activePostId
        ) return;

        const confirmed = window.confirm(
          "이 댓글을 삭제할까요? 삭제 후 복구할 수 없습니다."
        );

        if (!confirmed) return;

        deleteButton.disabled = true;
        deleteButton.textContent = "삭제 중…";

        let deletedOnServer = false;

        try {
          const { data: deleted, error: deleteError } =
            await client
              .from("community_comments")
              .delete()
              .eq("id", comment.id)
              .eq("author_id", currentUserId)
              .select("id");

          if (deleteError) throw deleteError;

          if (!deleted || deleted.length !== 1) {
            throw new Error(
              "Comment not deleted or permission unavailable"
            );
          }

          deletedOnServer = true;

          // 用户已打开另一篇帖子时，不更新那篇帖子的界面。
          if (
            version !== requestVersion ||
            postId !== activePostId
          ) return;

          item.remove();
          await loadComments(postId, version);
        } catch (error) {
          console.error("社区评论删除失败：", error);

          if (
            version !== requestVersion ||
            postId !== activePostId
          ) return;

          status.textContent = deletedOnServer
            ? "댓글은 삭제되었지만 목록을 불러오지 못했습니다. 다시 열어 확인해 주세요."
            : "삭제 완료를 확인하지 못했습니다. 댓글을 다시 열어 확인해 주세요.";
        } finally {
          deleteButton.disabled = false;
          deleteButton.textContent = "내 댓글 삭제";
        }
      });

      item.appendChild(deleteButton);
    }

    fragment.appendChild(item);
  }

  list.replaceChildren(fragment);

 const shownCount = list.children.length;

status.textContent = shownCount
  ? `댓글 ${shownCount}개 · 최근 50개에서 차단한 작성자 제외`
  : "최근 조회 범위에 표시할 댓글이 없습니다.";

}

  document.addEventListener(
    "pawview:community-open-post",
    async event => {
      if (submitting) {
        status.textContent = "댓글 게시가 끝난 뒤 이동해 주세요.";
        return;
      }

      const postId = event.detail?.postId;
      if (typeof postId !== "string") return;

      const version = ++requestVersion;
      activePostId = postId;
const commentConsent = document.getElementById(
  "communityCommentConsent"
);

if (commentConsent) commentConsent.checked = false;

      panel.hidden = false;
      title.textContent = "게시글을 불러오는 중…";
      meta.textContent = "";
      content.textContent = "";
      list.replaceChildren();
      input.value = "";
      submit.disabled = true;
      status.textContent = "";

      panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      try {
        const { data: post, error } = await client
          .from("community_posts")
         .select("id, author_id, title, content, created_at, author:community_profiles(nickname)")


          .eq("id", postId)
          .maybeSingle();

        if (version !== requestVersion) return;
        if (error) throw error;

        if (!post) {
          activePostId = null;
          title.textContent = "게시글을 볼 수 없습니다.";
          status.textContent =
            "삭제되었거나 공개되지 않은 게시글입니다.";
          return;
        }
const blockState = await window.PawCommunity.getBlockState();

if (version !== requestVersion) return;

if (blockState.blockedIds.has(post.author_id)) {
  activePostId = null;
  title.textContent = "차단한 사용자의 게시글입니다.";
  status.textContent = "차단 관리에서 해제할 수 있습니다.";
  submit.disabled = true;
  return;
}

        title.textContent = post.title;
        meta.textContent =
  (post.author?.nickname || "닉네임 없음") +
  " · " +
  new Date(post.created_at).toLocaleString("ko-KR");

        content.textContent = post.content;
        submit.disabled = false;

        await loadComments(postId, version);
      } catch (error) {
        if (version !== requestVersion) return;

        console.error("社区详情读取失败：", error);
        status.textContent =
          "내용을 불러오지 못했습니다. 닫은 뒤 다시 열어 주세요.";
      }
    }
  );

  form.addEventListener("submit", async event => {
    event.preventDefault();
if (submitting || !activePostId) return;

const consent = document.getElementById(
  "communityCommentConsent"
);

if (!consent?.checked) {
  status.textContent = "이용 안내와 댓글 공개 확인란을 체크해 주세요.";
  return;
}

const text = input.value.trim();


    if (
      Array.from(text).length < 1 ||
      Array.from(text).length > 1000
    ) {
      status.textContent = "댓글은 1~1000자로 입력해 주세요.";
      return;
    }

    const postId = activePostId;
    const version = requestVersion;
    let published = false;

    submitting = true;
    submit.disabled = true;
    input.disabled = true;
    close.disabled = true;
    status.textContent = "댓글을 게시하는 중…";

    try {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      const user = sessionData.session?.user;

      if (!user) {
        status.textContent = "위에서 닉네임을 먼저 저장해 주세요.";
        return;
      }

      const { data: profile, error: profileError } = await client
        .from("community_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        status.textContent = "위에서 닉네임을 먼저 저장해 주세요.";
        return;
      }

      const { error } = await client
        .from("community_comments")
        .insert({
          post_id: postId,
          author_id: user.id,
          content: text
        });

      if (error) throw error;

      published = true;

// 已关闭详情或切换帖子时，不再修改当前界面。
// 这里只停止界面更新，不代表撤销服务器已发布的评论。
if (
  version !== requestVersion ||
  postId !== activePostId
) return;

input.value = "";
consent.checked = false;

await loadComments(postId, version);

    } catch (error) {
      console.error("社区评论操作失败：", error);
      // 旧请求的错误不覆盖其他帖子或已关闭面板的提示。
if (
  version !== requestVersion ||
  postId !== activePostId
) return;

      if (error.message === "COMMUNITY_USER_RESTRICTED") {
  status.textContent =
    "현재 이 신분은 글과 댓글을 작성할 수 없습니다. 입력 내용은 유지했습니다.";
  return;
}

if (error.message === "COMMUNITY_COMMENT_RATE_LIMIT") {
  status.textContent =
    "댓글은 10초 간격으로 작성해 주세요. 입력 내용은 유지했습니다.";
  return;
}

      status.textContent = published
        ? "댓글은 게시되었지만 목록을 불러오지 못했습니다. 다시 열어 확인해 주세요."
        : "게시 완료를 확인하지 못했습니다. 입력은 유지했습니다. 재시도 전에 댓글 목록을 다시 확인해 주세요.";
    } finally {
      submitting = false;
      input.disabled = false;
      close.disabled = false;
      submit.disabled = !activePostId;
    }
  });
});
// 社区举报：不自动隐藏或删除内容。
(function setupCommunityReports() {
  const community = window.PawCommunity;
  if (!community) return;

  community.createReportButton = function (targetType, targetId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "community-report-button";
    button.textContent = "신고";

    let busy = false;

    button.addEventListener("click", async () => {
      if (busy) return;

      busy = true;
      button.disabled = true;

      try {
        const client = community.client;

        const { data: sessionData, error: sessionError } =
          await client.auth.getSession();

        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;

        if (!user) {
          window.alert("닉네임을 먼저 저장한 후 신고해 주세요.");
          return;
        }

        const { data: profile, error: profileError } =
          await client
            .from("community_profiles")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!profile) {
          window.alert("닉네임을 먼저 저장해 주세요.");
          return;
        }

        const choice = window.prompt(
          "신고 사유의 번호를 입력해 주세요.\n" +
          "1. 광고·도배\n" +
          "2. 욕설·괴롭힘\n" +
          "3. 개인정보 노출\n" +
          "4. 위험·유해 내용\n" +
          "5. 기타"
        );

        if (choice === null) return;

        const reasons = {
          "1": "spam",
          "2": "abuse",
          "3": "privacy",
          "4": "dangerous",
          "5": "other"
        };

        const reason = reasons[choice.trim()];

        if (!reason) {
          window.alert("1~5 중 하나를 입력해 주세요.");
          return;
        }

        const detailInput = window.prompt(
          "추가 설명을 입력해 주세요. (선택, 최대 500자)\n" +
          "개인정보를 입력하지 마세요.\n" +
          "취소를 누르면 신고를 제출하지 않습니다.",
          ""
        );

        if (detailInput === null) return;

        const detail = detailInput.trim();

        if (Array.from(detail).length > 500) {
          window.alert("추가 설명은 500자 이내로 입력해 주세요.");
          return;
        }

        const confirmed = window.confirm(
          "신고를 제출할까요?\n" +
          "관리자 검토 요청이며, 즉시 삭제되지는 않습니다."
        );

        if (!confirmed) return;

        button.textContent = "제출 중…";

        const report = {
          reporter_id: user.id,
          reason,
          detail
        };

        if (targetType === "post") {
          report.post_id = targetId;
        } else if (targetType === "comment") {
          report.comment_id = targetId;
        } else {
          throw new Error("Invalid report target");
        }

        // 举报表不开放读取，所以这里不要追加 .select()。
        const { error } = await client
          .from("community_reports")
          .insert(report);

              if (error) {
          if (error.code === "23505") {
            window.alert("이미 신고한 내용입니다.");
            return;
          }

          throw error;
        }

        window.alert(
          "신고가 접수되었습니다. 관리자가 검토합니다."
        );
      } catch (error) {
        console.error("社区举报提交失败：", error);

        window.alert(
          "접수 완료를 확인하지 못했습니다. " +
          "연결 상태를 확인해 주세요. " +
          "재시도 시 이미 신고한 내용으로 표시될 수 있습니다."
        );
      } finally {
        busy = false;
        button.disabled = false;
        button.textContent = "신고";
      }
    });

    return button;
  };
})();
// 屏蔽列表：存服务器，按用户ID识别，不按昵称识别。
(function setupCommunityBlocks() {
  const community = window.PawCommunity;
  if (!community) return;

  community.getBlockState = async function () {
    const { data: sessionData, error: sessionError } =
      await community.client.auth.getSession();

    if (sessionError) throw sessionError;

    const userId = sessionData.session?.user?.id || null;

    if (!userId) {
      return { userId: null, blockedIds: new Set() };
    }

    // 分页读取，避免只拿到默认上限以内的屏蔽记录。
    const ids = [];
    const size = 500;

    for (let offset = 0; ; offset += size) {
      const { data, error } = await community.client
        .from("community_blocks")
        .select("blocked_id")
        .eq("blocker_id", userId)
        .order("blocked_id")
        .range(offset, offset + size - 1);

      if (error) throw error;

      ids.push(...data.map(row => row.blocked_id));
      if (data.length < size) break;
    }

    return {
      userId,
      blockedIds: new Set(ids)
    };
  };

  community.createBlockButton = function (authorId, nickname) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "community-report-button";
    button.textContent = "작성자 차단";

    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;

      try {
        const state = await community.getBlockState();

        if (!state.userId) {
          window.alert("닉네임을 먼저 저장해 주세요.");
          return;
        }

        if (state.userId === authorId) {
          window.alert("자신을 차단할 수 없습니다.");
          return;
        }

        const confirmed = window.confirm(
          `${nickname || "이 사용자"} 님을 차단할까요?\n` +
          "이 사용자의 글과 댓글을 숨깁니다.\n" +
          "현재 열린 상세 화면과 작성 중인 댓글은 닫힙니다."
        );

        if (!confirmed) return;

        const { error } = await community.client
          .from("community_blocks")
          .insert({
            blocker_id: state.userId,
            blocked_id: authorId
          });

        // 已存在也按屏蔽成功处理。
        if (error && error.code !== "23505") throw error;

        document.dispatchEvent(
          new CustomEvent("pawview:community-blocks-updated")
        );

        window.alert("차단했습니다.");
      } catch (error) {
        console.error("屏蔽用户失败：", error);
        window.alert(
          "차단 완료를 확인하지 못했습니다. 차단 목록에서 확인해 주세요."
        );
      } finally {
        button.disabled = false;
      }
    });

    return button;
  };

  document.addEventListener("DOMContentLoaded", () => {
    const refresh = document.getElementById("communityRefreshButton");
    if (!refresh || document.getElementById("communityBlockManager")) {
      return;
    }

    const manager = document.createElement("button");
    manager.id = "communityBlockManager";
    manager.type = "button";
    manager.className = "secondary-button";
    manager.textContent = "차단 관리";
    manager.style.marginLeft = "8px";

    refresh.insertAdjacentElement("afterend", manager);

    const box = document.createElement("div");
    box.hidden = true;

    const panel = refresh.closest("article");
    if (!panel) return;
    panel.appendChild(box);

    let busy = false;

    async function renderManager() {
      if (busy) return;

      busy = true;
      manager.disabled = true;
      box.hidden = false;
      box.textContent = "차단 목록을 불러오는 중…";

      try {
        const state = await community.getBlockState();
        box.replaceChildren();

        if (!state.userId || state.blockedIds.size === 0) {
          box.textContent = "차단한 사용자가 없습니다.";
          return;
        }

        const label = document.createElement("p");
        label.textContent =
          `차단한 사용자 ${state.blockedIds.size}명`;

        box.appendChild(label);

        // 逐个显示，避免把大量ID塞进一个请求。
        for (const blockedId of state.blockedIds) {
          const row = document.createElement("p");

          const { data: profile, error } = await community.client
            .from("community_profiles")
            .select("nickname")
            .eq("user_id", blockedId)
            .maybeSingle();

          if (error) throw error;

          const name = document.createElement("span");
          name.textContent =
            (profile?.nickname || "닉네임 없음") + " ";

          const unblock = document.createElement("button");
          unblock.type = "button";
          unblock.className = "community-report-button";
          unblock.textContent = "차단 해제";

          unblock.addEventListener("click", async () => {
            if (unblock.disabled) return;

            if (!window.confirm(
              "차단을 해제할까요?\n" +
              "현재 열린 상세 화면과 작성 중인 댓글은 닫힙니다."
            )) return;

            unblock.disabled = true;

            try {
              const { data: deleted, error: deleteError } =
                await community.client
                  .from("community_blocks")
                  .delete()
                  .eq("blocker_id", state.userId)
                  .eq("blocked_id", blockedId)
                  .select("blocked_id");

              if (deleteError) throw deleteError;
              if (!deleted?.length) {
                throw new Error("Block not removed");
              }

              document.dispatchEvent(
                new CustomEvent("pawview:community-blocks-updated")
              );

              await renderManager();
            } catch (error) {
              console.error("取消屏蔽失败：", error);
              window.alert(
                "해제 완료를 확인하지 못했습니다. 목록을 다시 확인해 주세요."
              );
            } finally {
              unblock.disabled = false;
            }
          });

          row.append(name, unblock);
          box.appendChild(row);
        }
      } catch (error) {
        console.error("屏蔽列表读取失败：", error);
        box.textContent = "차단 목록을 불러오지 못했습니다.";
      } finally {
        busy = false;
        manager.disabled = false;
      }
    }

    manager.addEventListener("click", () => {
      if (!box.hidden) {
        box.hidden = true;
      } else {
        renderManager();
      }
    });
  });
})();
