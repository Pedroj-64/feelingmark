import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, Linking, Platform, Pressable, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { DownloadSimple, Link, Play, Plus, ShareNetwork } from "phosphor-react-native";
import { createApi, type Api, type CollectionDetail, type TimelineItem } from "../src/api";
import { confirmAsk } from "../src/confirm";
import { PromptModal } from "../src/prompt-modal";
import { loadConn } from "../src/settings";
import { useTheme } from "../src/theme";
import { flushQueue, pickAndEnqueue } from "../src/uploads";
import { Button, Skeleton, Text } from "../src/ui";

const COLS = 3;
const GAP = 3;

/** Un álbum propio: fotos, portada, enlace de invitación (solo ver y descargar) y descarga en .zip. */
export default function AlbumScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Number(idParam);
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [api, setApi] = useState<Api | null>(null);
  const [col, setCol] = useState<CollectionDetail | null>(null);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/albums"));

  const reload = useCallback(
    async (a: Api) => {
      try {
        setCol(await a.collection(id));
      } catch {
        leave(); // el álbum ya no existe
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );
  useFocusEffect(
    useCallback(() => {
      loadConn().then((conn) => {
        if (!conn) return;
        const a = createApi(conn);
        setApi(a);
        void reload(a);
      });
    }, [reload]),
  );
  const flash = (m: string) => {
    setNote(m);
    setTimeout(() => setNote(null), 3000);
  };
  const fail = () => flash(t("common.error"));

  const addFromPhone = async () => {
    if (!api) return;
    setMenu(false);
    if ((await pickAndEnqueue(undefined, id)) > 0) {
      await flushQueue(api);
      await reload(api);
    }
  };
  const share = async () => {
    if (!api || !col) return;
    try {
      const link = await api.invite(id);
      await reload(api);
      const message = t("album.shareMessage", { name: col.name, link });
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(link);
        flash(t("album.linkCopied"));
      } else await Share.share({ message });
    } catch {
      fail();
    }
  };
  const stopSharing = async () => {
    if (!api) return;
    if (await confirmAsk(t("album.stopTitle"), t("album.stopBody"), t("album.stopShare"), t("day.cancel"))) {
      await api.revokeInvite(id).then(() => reload(api), fail);
    }
  };
  const download = async () => {
    if (!api) return;
    try {
      void Linking.openURL(await api.downloadLink(id));
    } catch {
      fail();
    }
  };
  const remove = async () => {
    if (!api) return;
    if (await confirmAsk(t("album.deleteTitle"), t("album.deleteBody"), t("album.delete"), t("day.cancel"))) {
      await api.deleteCollection(id).then(leave, fail);
    }
  };
  const itemActions = (it: TimelineItem) => {
    if (!api) return;
    const setCover = () => api.updateCollection(id, { cover: it.id }).then(() => reload(api), fail);
    const take = () => api.removeFromCollection(id, it.id).then(() => reload(api), fail);
    if (Platform.OS === "web") return void (window.confirm(t("album.remove")) && take());
    Alert.alert(t("album.options"), undefined, [
      { text: t("album.cover"), onPress: () => void setCover() },
      { text: t("album.remove"), style: "destructive", onPress: () => void take() },
      { text: t("day.cancel"), style: "cancel" },
    ]);
  };

  const size = (Math.min(width, 720) - 32 - GAP * (COLS - 1)) / COLS;
  const rows: TimelineItem[][] = [];
  for (let i = 0; i < (col?.items.length ?? 0); i += COLS) rows.push(col!.items.slice(i, i + COLS));
  const date = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" });

  const header = (
    <View>
      <Pressable onPress={leave} hitSlop={12} accessibilityRole="button" style={s.back}>
        <Text style={{ color: c.accent, fontWeight: "600" }}>‹ {t("album.back")}</Text>
      </Pressable>
      {col ? (
        <>
          <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
            {col.name}
          </Text>
          <Text style={{ color: c.muted }}>{t("album.count", { count: col.items.length })}</Text>
        </>
      ) : (
        <Skeleton style={{ height: 34, width: 220, marginVertical: 12 }} />
      )}
      {note && (
        <Text accessibilityLiveRegion="polite" style={{ color: c.accent, marginTop: 8 }}>
          {note}
        </Text>
      )}
      <View style={s.actions}>
        <Button
          label={t("album.add")}
          icon={<Plus size={20} color={c.onAccent} />}
          disabled={!api}
          onPress={() => setMenu((m) => !m)}
          style={{ flex: 1 }}
        />
        <Button
          kind="ghost"
          label={t("album.share")}
          icon={<ShareNetwork size={20} color={c.accent} />}
          disabled={!col}
          onPress={share}
          style={{ flex: 1 }}
        />
      </View>
      {menu && (
        <View style={s.actions}>
          <Button
            kind="ghost"
            label={t("album.addLibrary")}
            onPress={() => (setMenu(false), router.push({ pathname: "/pick", params: { id: String(id) } }))}
            style={{ flex: 1 }}
          />
          {Platform.OS !== "web" && <Button kind="ghost" label={t("album.addPhone")} onPress={addFromPhone} style={{ flex: 1 }} />}
        </View>
      )}
      <View style={s.actions}>
        <Button
          kind="ghost"
          label={t("album.download")}
          icon={<DownloadSimple size={20} color={c.accent} />}
          disabled={!col || col.items.length === 0}
          onPress={download}
          style={{ flex: 1 }}
        />
      </View>
      {col?.shared && (
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Link size={18} color={c.ink} />
            <Text style={{ color: c.ink, fontWeight: "600", flex: 1 }}>
              {col.people === 0 ? t("album.nobody") : t("album.opened", { count: col.people })}
            </Text>
          </View>
          <Text style={{ color: c.muted, marginTop: 6, lineHeight: 20 }}>{t("album.shareHint")}</Text>
          <Pressable accessibilityRole="button" onPress={stopSharing} style={s.link}>
            <Text style={{ color: c.accent, fontWeight: "600" }}>{t("album.stopShare")}</Text>
          </Pressable>
        </View>
      )}
      {col && col.items.length === 0 && (
        <Text style={{ color: c.muted, textAlign: "center", marginVertical: 24, lineHeight: 22 }}>{t("album.empty")}</Text>
      )}
      {col && col.items.length > 0 && (
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 16, marginBottom: 10 }}>{t("album.holdHint")}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r[0].id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ width: Math.min(width, 720), alignSelf: "center", padding: 16, paddingBottom: 40 }}
        initialNumToRender={8}
        removeClippedSubviews
        ListFooterComponent={
          col ? (
            <View style={{ gap: 4, marginTop: 24 }}>
              <Pressable accessibilityRole="button" onPress={() => setRenaming(true)} style={s.link}>
                <Text style={{ color: c.accent, fontWeight: "600" }}>{t("album.rename")}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={remove} style={s.link}>
                <Text style={{ color: c.accent, fontWeight: "600" }}>{t("album.delete")}</Text>
              </Pressable>
            </View>
          ) : undefined
        }
        renderItem={({ item: r }) => (
          <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP }}>
            {r.map((it) => (
              <Pressable
                key={it.id}
                accessibilityRole="button"
                accessibilityLabel={date(it.takenAt)}
                accessibilityHint={t("album.holdHint")}
                onPress={() =>
                  router.push({
                    pathname: "/day",
                    params: { date: it.takenAt.slice(0, 10), ids: String(it.id), videos: it.video ? String(it.id) : "" },
                  })
                }
                onLongPress={() => itemActions(it)}
                style={{ width: size, height: size, borderRadius: 6, overflow: "hidden", backgroundColor: c.surface }}
              >
                {api && (
                  <Image
                    source={api.thumbSource(it.id)}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="disk"
                    recyclingKey={String(it.id)}
                    accessible={false}
                  />
                )}
                {it.video && (
                  <View style={s.play}>
                    <Play size={14} weight="fill" color="#fff" />
                  </View>
                )}
                {col?.cover === it.id && <View style={[s.coverDot, { backgroundColor: c.accent }]} />}
              </Pressable>
            ))}
          </View>
        )}
      />
      <PromptModal
        visible={renaming}
        title={t("album.renameTitle")}
        initial={col?.name}
        confirm={t("album.save")}
        onSubmit={(name) => {
          setRenaming(false);
          if (api) void api.updateCollection(id, { name }).then(() => reload(api), fail);
        }}
        onClose={() => setRenaming(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  title: { fontSize: 28, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.5, marginTop: 8, marginBottom: 2 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 16 },
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  play: {
    position: "absolute",
    left: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(22,19,15,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverDot: { position: "absolute", right: 6, top: 6, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: "#fff" },
});
